# Close Deal Service

Sale Service — Close Deal Module  
**Stack:** Node.js + Express + PostgreSQL + KafkaJS

---

## โครงสร้างไฟล์

```
close-deal-service/
├── src/
│   ├── index.js                          # Entry point + Kafka consumer
│   ├── db/index.js                       # PostgreSQL connection + migration
│   ├── kafka/index.js                    # Producer & Consumer
│   ├── routes/close-deal.routes.js
│   ├── controllers/close-deal.controller.js
│   └── services/close-deal.service.js    # Business logic
├── .env.example
└── package.json
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/close-deals` | ดึง close deal ทั้งหมด (filter: customerId, propertyId, status) |
| GET | `/api/close-deals/:id` | ดึงด้วย UUID หรือ booking_id |
| POST | `/api/close-deals` | สร้าง close deal record (manual) |
| PATCH | `/api/close-deals/:id/delivery` | อัปเดต delivery status |
| POST | `/api/close-deals/:id/close` | Manual trigger ปิด deal |
| GET | `/health` | Health check |

---

## Kafka Topics

| Direction | Topic | Description |
|-----------|-------|-------------|
| Subscribe | `sale.booked.complete` | สร้าง close deal record หลัง booking สำเร็จ |
| Subscribe | `sale.statussurvey.complete` | อัปเดต survey status |
| Subscribe | `payment.secondpayment.completed` | อัปเดต second payment status |
| Subscribe | `postsales.handover.completed` | อัปเดต delivery status |
| Publish | `sale.closedeal.complete` | แจ้ง service อื่นว่า deal ปิดแล้ว |

---

## เงื่อนไขการปิด Deal (Auto + Manual)

Deal จะถูกปิดอัตโนมัติเมื่อครบทุกเงื่อนไข:

| เงื่อนไข | ค่าที่ต้องการ |
|---------|------------|
| payment_first_status | `CONFIRMED` |
| payment_second_status | `CONFIRMED` |
| status_survey | `COMPLETED` |
| status_delivery | `COMPLETED` |

หากต้องการปิด manual ใช้ `POST /api/close-deals/:id/close`  
ถ้าเงื่อนไขไม่ครบจะได้รับ error 400 พร้อมบอกว่าติดขัดที่ไหน

---

## Close Deal Status Flow

```
IN_PROGRESS → CLOSED
```

เมื่อ CLOSED จะ:
1. Publish `sale.closedeal.complete`
2. แจ้ง Post-Sales service (`postsales.handover`)
3. แจ้ง Marketing service

---

## วิธีรัน

```bash
npm install
cp .env.example .env
npm run dev
```

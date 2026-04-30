const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'close-deal-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || 'sale-closedeal-group' });

const connectKafka = async () => {
  await producer.connect();
  await consumer.connect();
  console.log('✅ Kafka connected');
};

const publishEvent = async (topic, message) => {
  await producer.send({
    topic,
    messages: [
      {
        key: message.bookingId || String(Date.now()),
        value: JSON.stringify(message),
      },
    ],
  });
  console.log(`📤 Published to [${topic}]:`, message);
};

const subscribeToTopics = async (topics, handler) => {
  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        console.log(`📥 Received from [${topic}]:`, payload);
        await handler(topic, payload);
      } catch (err) {
        console.error(`❌ Error processing message from [${topic}]:`, err);
      }
    },
  });
};

const disconnectKafka = async () => {
  await producer.disconnect();
  await consumer.disconnect();
};

module.exports = { connectKafka, publishEvent, subscribeToTopics, disconnectKafka };

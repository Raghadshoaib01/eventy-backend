// src/test-redis.ts

import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.REDIS_URL;

if (!url) {
  throw new Error('REDIS_URL is not defined');
}

const client = new Redis(url);
  console.log(client.options);

async function testRedis() {
  try {
    console.log('Connecting to Redis...');

    // اختبار ping
    const pong = await client.ping();
    console.log('PING:', pong);

    // اختبار كتابة
    await client.set('foo', 'bar');

    // اختبار قراءة
    const value = await client.get('foo');

    console.log('Value from Redis:', value);

    console.log('✅ Redis is working correctly');
  } catch (error) {
    console.error('❌ Redis connection failed');
    console.error(error);
  } finally {
    await client.quit();
  }
}

testRedis();
// Node 18+ has global fetch
const COURSE_API = 'http://localhost:3002/api/courses';

async function testCache() {
  console.log('--- Testing Course Cache Performance ---');

  try {
    // Lần 1: Chắc chắn MISS (hoặc nếu vừa khởi động là MISS)
    console.log('Request 1 (Expecting MISS)...');
    const start1 = Date.now();
    const res1 = await fetch(COURSE_API);
    const data1 = await res1.json();
    const duration1 = Date.now() - start1;
    console.log(`Duration 1: ${duration1}ms`);
    console.log(`Success: ${data1.success}`);

    // Đợi 1 chút để async cache write hoàn tất
    await new Promise(resolve => setTimeout(resolve, 500));

    // Lần 2: Kỳ vọng HIT
    console.log('\nRequest 2 (Expecting HIT)...');
    const start2 = Date.now();
    const res2 = await fetch(COURSE_API);
    const data2 = await res2.json();
    const duration2 = Date.now() - start2;
    console.log(`Duration 2: ${duration2}ms`);
    console.log(`Success: ${data2.success}`);

    if (duration2 < duration1) {
      console.log(`\n✅ Performance improved! Saved ${duration1 - duration2}ms`);
    } else {
      console.log('\n⚠️ Performance did not improve significantly. (Note: on local/neon the first query might be very slow due to cold start, while the second is fast even without cache due to DB connection warmup)');
    }

    // Lần 3: Filter khác -> Phải MISS
    console.log('\nRequest 3 (Different category, Expecting MISS)...');
    const start3 = Date.now();
    const res3 = await fetch(`${COURSE_API}?category=test-slug`);
    const data3 = await res3.json();
    const duration3 = Date.now() - start3;
    console.log(`Duration 3: ${duration3}ms`);

    console.log('\n--- Caching Test Completed ---');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testCache();

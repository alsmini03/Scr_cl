async function debug() {
    const url = 'https://blog.naver.com/intelligent_tiger/224216458984';
    const response = await fetch('http://localhost:3000/api/blog/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });
    const text = await response.text();
    console.log('Raw response:', text);
}
debug();

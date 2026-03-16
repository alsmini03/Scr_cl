async function test() {
    const url = 'https://blog.naver.com/intelligent_tiger/224216458984';
    try {
        const response = await fetch('http://localhost:3000/api/blog/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        console.log('Title:', data.title);
        console.log('Content Length:', data.content?.length);
        console.log('Content Preview:', data.content?.substring(0, 200));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();

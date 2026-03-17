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
        // Show a middle section of content to see paragraph breaks
        console.log('Content Middle Section:\n', data.content?.substring(500, 1000));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();

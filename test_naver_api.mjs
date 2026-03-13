async function test() {
    const blogId = 'totcar';
    const categoryNo = '1';
    const url = `https://m.blog.naver.com/PostTitleListAsync.naver?blogId=${blogId}&categoryNo=${categoryNo}&countPerPage=30`;

    console.log(`Testing API: ${url}`);
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
            "Referer": `https://m.blog.naver.com/PostList.naver?blogId=${blogId}`,
            "X-Requested-With": "XMLHttpRequest"
        }
    });

    const text = await res.text();
    try {
        const data = JSON.parse(text);
        if (data.postList) {
            console.log(`Found ${data.postList.length} posts`);
            data.postList.slice(0, 3).forEach(p => {
                console.log(`- ${p.titleWithOutEmoji} (https://m.blog.naver.com/${blogId}/${p.logNo})`);
            });
        } else {
            console.log("No postList in JSON", data);
        }
    } catch (e) {
        console.log("Not JSON. Snippet:", text.substring(0, 200));
    }
}

test();

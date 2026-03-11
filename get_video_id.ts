import { getYoutubeVideos } from './src/lib/db';

async function main() {
  const videos = await getYoutubeVideos();
  if (videos.length > 0) {
    console.log(videos[0].id);
  } else {
    console.log("NO_VIDEOS");
  }
}

main();

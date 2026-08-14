// Matches watch?v=, youtu.be/, embed/, and shorts/ URL shapes.
const YOUTUBE_ID_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/;

export function youtubeId(url) {
  if (!url) return null;
  const match = url.match(YOUTUBE_ID_RE);
  return match ? match[1] : null;
}

// hqdefault is guaranteed to exist for every uploaded video, unlike
// maxresdefault which many videos don't have.
export function youtubeThumbnail(url) {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

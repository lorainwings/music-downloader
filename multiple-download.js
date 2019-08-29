
const { collectInput, axiosInstance, getSongList, multiDownload } = require('./apis');

const taskOpen = async () => {
    const shareUrl = await collectInput(
        '请输入QQ音乐歌单链接：',
        '歌单链接'
    );
    const url = `https://api.ooopn.com/restore/api.php?url=${encodeURIComponent(shareUrl)}`;
    const { data: { longUrl } } = await axiosInstance(url);
    const { search } = new URL(longUrl);
    const id = search.match(/\?id=(\d+)$/i)[1];
    const musicList = await getSongList(id);
    multiDownload(musicList);
}

taskOpen();
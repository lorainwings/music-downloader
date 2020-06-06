
const { collectInput, axiosInstance, getSongList, multiDownload } = require('./apis');

const taskOpen = async () => {
    let musicList;
    const shareUrl = await collectInput(
        '请输入QQ音乐歌单链接：',
        '歌单链接'
    );
    const url = `https://api.uomg.com/api/dwz2long?url=${encodeURIComponent(shareUrl)}`;
    const { data: { ae_url: longUrl } } = await axiosInstance(url);
    const id = longUrl.match(/\?id=(\d+)$/i) || longUrl.match(/\/(\d+)\.html$/i);
    id ? (musicList = await getSongList(id[1])) : console.log("QQ音乐的歌单分享链接不正确!".red.bold);
    multiDownload(musicList);
}

taskOpen();
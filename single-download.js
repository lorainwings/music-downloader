const { collectInput, singleDownload } = require('./apis');


const taskOpen = async () => {
    const name = await collectInput(
        '请输入要搜索的歌曲名：',
        '歌曲名'
    );
    const singer = await collectInput(
        '请输入该曲的歌手名：',
        '歌手名'
    );
    singleDownload(name, singer);
}

taskOpen();
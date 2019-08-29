require('colors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');
const ProgressBar = require('progress');

let bar;

const axiosInstance = (url, opts) => {
    return axios({
        url,
        method: 'get',
        ...opts
    })
}

// songListId 歌单id
const getSongList = async (songListId) => {
    const url = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&new_format=1&disstid=${songListId}&g_tk=194494277&loginUin=272127668&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`;
    const { data: { cdlist: [{ songlist }] } } = await axiosInstance(url, {
        headers: {
            Referer: `https://y.qq.com/n/yqq/playlist/${songListId}.html`
        }
    });
    return songlist;
}

// 歌曲搜索
const searchMusic = (name, artist = '') => {
    const url = encodeURI(`http://search.kuwo.cn/r.s?client=kt&all=${name}&pn=0&rn=200&uid=221260053&ver=kwplayer_ar_99.99.99.99&vipver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1`);
    return axiosInstance(url).then((res) => {
        let idx, mid;
        res = res.data;
        try {
            if (Array.isArray(res.abslist) && artist) {
                idx = res.abslist.findIndex(item => item.ARTIST === artist);
            } else {
                idx = 1;
            }
            mid = res.abslist[idx === -1 ? 1 : idx].MUSICRID.split('_')[1];
            return { name, mid, artist }
        } catch (e) {
            return { name, mid: -2000, artist } // -2000 未读到相应的值
        }
    })
}


const analyUrl = (list) => {
    const plists = list.map((item) => {
        return searchMusic(item.name, item.singer[0].name);
    });
    return Promise.all(plists).then((res) => {
        return res;
    }).catch(function (reason) {
        console.log("出错!", reason);
        return [];
    });
}

// 查询音频格式
const parseAudioFormat = async (mid) => {
    const originUrl = `http://antiserver.kuwo.cn/anti.s?response=url&rid=MUSIC_${mid}&format=aac|mp3&type=convert_url`;
    const { data } = await axiosInstance(originUrl);
    const index = data.lastIndexOf('.');
    const format = index === -1 ? 'aac' : data.slice(index + 1);
    return {
        format, downloadUrl: data
    }
}


const downladAudio = async (singer) => {
    const { mid, name, artist } = singer;
    // const url = `https://v1.itooi.cn/kuwo/url?id=${mid}&quality=320`;
    const { format, downloadUrl } = await parseAudioFormat(mid);
    const savePath = path.resolve(__dirname, './music');
    const response = await axiosInstance(downloadUrl, {
        responseType: 'stream'
    })
    const file = path.resolve(savePath, `${name}-${artist}.${format}`);
    const writer = fs.createWriteStream(file);
    // pipe the result stream into a file on disc
    response.data.pipe(writer)
    return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });
}

const downloadQueue = async (midList) => {
    for (let item of midList) {
        const { mid, name, artist } = item;
        const { format } = await parseAudioFormat(mid);
        const file = path.resolve(__dirname, `./music/${name}-${artist}.${format}`);
        // 已经下载过的跳过
        if (fs.existsSync(file)) {
            bar.tick(1);
            continue;
        };
        mid !== -2000 && await downladAudio(item);
        bar.tick(1);
    }
}

// 歌单下载
const multiDownload = async (list) => {
    try {
        console.log("下载准备中,请等待...")
        bar = new ProgressBar(`下载进度: [:bar :current/:total](:rate/bps :percent :etas)`, { total: list.length, width: 100, complete: '█' });
        const midList = await analyUrl(list);
        console.log("音乐ID分析完成! 🐥🐥🐥");
        await downloadQueue(midList);
    } catch (e) {
        console.log('下载错误了:', e)
    }
    console.log("下载完成! 👻👻👻")
}

// 单曲下载
const singleDownload = async (...args) => {
    try {
        console.log("搜索音乐:" + args);
        const musicInfo = await searchMusic(...args);
        bar = new ProgressBar(`下载进度: [:bar :current/:total](:rate/bps :percent :etas)`, { total: 1, width: 100, complete: '█' });
        console.log("音乐已经找到! 🐥🐥🐥");
        await downladAudio(musicInfo);
    } catch (e) {
        console.log('下载错误了:', e)
    }
    console.log("下载完成! 👻👻👻")
}


/**
 * @desc 接受用户输入内容
 * @param {*} tips 提示内容
 */
const readSyncByRl = tips => {
    tips = tips || '> ';
    return new Promise(resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(tips, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
};


const collectInput = async (prompt, name) =>
    readSyncByRl(prompt).then(async input => {
        if (input === '') {
            collectInput(`❌   ${name}为空,请重新输入： ❌\n`.red.bold, name);
            process.exit();
        }
        console.log(`✅   你输入的${name}为:   ${input}   ✅`.green.bold);
        return input;
    });


module.exports = {
    collectInput,
    axiosInstance,
    getSongList, // 歌单搜索
    multiDownload, // 歌单下载
    searchMusic, // 单曲搜索
    singleDownload // 单曲下载
}

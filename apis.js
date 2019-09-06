require('colors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const fuzzy = require('fuzzy');
const inquirer = require('inquirer');
const readline = require('readline');
const ProgressBar = require('progress');
const autocomplete = require('inquirer-autocomplete-prompt');
inquirer.registerPrompt('autocomplete', autocomplete);

let bar;

const axiosInstance = (url, opts) => {
    return axios({
        url,
        method: 'get',
        ...opts
    })
}

// 列表选择
const selectMusic = async options => {
    const target = await inquirer.prompt([
        {
            type: 'autocomplete',
            name: 'name',
            pageSize: 40,
            message: '请选择下载哪一项(可上下选择或者输入关键词)?',
            source(ans, input = '') {
                return new Promise(resolve => {
                    setTimeout(() => {
                        const fuzzyResult = fuzzy.filter(input, options);
                        resolve(fuzzyResult.map(el => el.original));
                    }, 100);
                });
            }
        }
    ]);
    return { key: target.name };
};


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
const searchMusic = async (name, artist = '') => {
    let idx, mid;
    const url = encodeURI(`http://search.kuwo.cn/r.s?client=kt&all=${name}&pn=0&rn=200&uid=221260053&ver=kwplayer_ar_99.99.99.99&vipver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1`);
    const res = await axiosInstance(url);
    const { abslist } = res.data;
    try {
        if (Array.isArray(abslist) && artist) {
            idx = abslist.findIndex(item => item.ARTIST.indexOf(artist) !== -1);
        } else {
            idx = 1;
        }
        mid = abslist[idx === -1 ? 1 : idx].MUSICRID.split('_')[1];
        return { name, mid, artist }
    } catch (e) {
        return { name, mid: -2000, artist } // -2000 未读到相应的值
    }
}

// 歌曲搜索(带列表选择)
const searchMusicByChoose = async (name, artist) => {
    const url = encodeURI(`http://www.kuwo.cn/api/www/search/searchMusicBykeyWord?key=${name}&pn=1&rn=200&reqId=47c24e10-cfb4-11e9-b8c2-754f2a15596d`);
    let rid;
    const res = await axiosInstance(url);
    const { list } = res.data.data;
    try {
        if (Array.isArray(list) && artist) {
            const idx = list.findIndex(item => item.artist.indexOf(artist) !== -1);
            ({ rid } = list[idx === -1 ? 1 : idx]);
        } else {
            const opts = list.map(({ name, artist }, idx) => `${idx}. ${name} —————————————————————————————— ${artist}`);
            const { key } = await selectMusic(opts);
            ({ rid, artist } = list[key.split(/\.\s+/)[0]]);
        }
        return { name, mid: rid, artist };
    } catch (e) {
        return { name, mid: -2000, artist }; // -2000 未读到相应的值
    }
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
    const originUrl = `http://antiserver.kuwo.cn/anti.s?response=url&rid=MUSIC_${mid}&format=mp3|aac&type=convert_url`;
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
        writer.on("error", () => {
            reject(downloadUrl)
        });
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
        console.log(`搜索音乐: ${args.join(" ")}`);
        const musicInfo = await searchMusicByChoose(...args);
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

// notEmpty=1 必须输入值 
// notEmpty=0 非必须输入
const collectInput = async (prompt, name, notEmpty = 1) =>
    readSyncByRl(prompt).then(async input => {
        if (notEmpty === 1 && input === '') {
            collectInput(`❌   ${name}为空,请重新输入： ❌\n`.red.bold, name);
            process.exit();
        } else if (notEmpty === 0 && input === '') {
            console.log(`⚠️   你输入的${name}为:   默认值(空)    ⚠️`.yellow.bold);
        } else {
            console.log(`✅   你输入的${name}为:   ${input}   ✅`.green.bold);
        }
        return input;
    });


module.exports = {
    collectInput,
    axiosInstance,
    getSongList, // 歌单搜索
    multiDownload, // 歌单下载
    searchMusic, // 单曲搜索
    searchMusicByChoose, // 单曲搜索带列表选取
    singleDownload // 单曲下载
}

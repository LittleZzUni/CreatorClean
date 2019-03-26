
'use strict';

const Fs = require('fs');
const FFs = require('fire-fs');
const cp = require('child_process');

var PATH = {
    html: Editor.url('packages://Clean/panel/panel.html'),
    style: Editor.url('packages://Clean/panel/less.css'),
    ignore: Editor.url('packages://Clean/panel/ignore.json')
};

var createVM = function (elem) {
    return new Vue({
        el: elem,
        data: {
            resources: true,
            isDone: false,
            input: "",
            items: [],
            ignore: null,
            type: ['sprite-frame'],
        },
        watch: {
            resources() {
                this.refresh();
            },
        },
        methods: {

            refresh() {
                this.isDone = false;
                let adb = Editor.assetdb;
                let self = this;
                let custIngnore = this.splitInput(this.input);

                this.items.length = 0;
                this.items = [];
                let callback = function (objs, results) {
                    objs.forEach(function (obj) {
                        if (self.ignore.prefab.indexOf(obj.url) != -1) {
                            return;
                        }

                        if (!obj.destPath) {
                            return;
                        }
                        
                        let json = FFs.readFileSync(obj.destPath, 'utf-8');

                        for (let i = 0; i < results.length; ++i) {
                            let result = results[i];
                            if (result.hidden) {
                                result.contain = true;
                                continue;
                            }

                            for (let i = 0; i < custIngnore.length; i++) {
                                if (result.url.indexOf(custIngnore[i]) !== -1) {
                                    result.contain = true;
                                    continue;
                                }
                            }

                            if (self.resources &&
                                result.url.indexOf('db://assets/resources') !== -1) {
                                result.contain = true;
                                continue;
                            }

                            if (!result.jsonObj) {
                                result.jsonObj = FFs.readJsonSync(result.destPath);
                            }

                            if (result.jsonObj && result.jsonObj.content) {
                                if (result.jsonObj.content.atlas) {
                                    result.contain = true;
                                    continue;
                                }
                            }

                            let isContain = json.indexOf(result.uuid) > -1;
                            result.contain = result.contain ? true :  isContain;
                        }
                    });

                    let excludeSpriteFramesTexture = [];
                    results.forEach(function (result) {
                        if (result.contain) {
                            if (result.jsonObj) {
                                if (result.jsonObj.content) {
                                    let atlasUuid = result.jsonObj.content.atlas;
                                    let textureUuid =result.jsonObj.content.texture; 
                                    if (atlasUuid) {
                                        if (excludeSpriteFramesTexture.indexOf(textureUuid) === -1) {
                                            excludeSpriteFramesTexture.push(textureUuid);
                                        }
                                    }
                                }
                            }
                        }
                    });

                    results.forEach(function (result) {
                        if (!result.contain) {
                            if (result.jsonObj) {
                                let uuid = result.jsonObj.content.texture;
                                if (excludeSpriteFramesTexture.indexOf(uuid) !== -1) {
                                    console.error('exclude texture atlas ' + result.url);
                                    return;
                                }
                            }
                            self.items.push({url: result.url, uuid: result.uuid});
                        }
                    });

                    self.isDone = true;
                };

                adb.queryAssets(
                    null,
                    ['scene', 'prefab', 'animation-clip', 'bitmap-font'],
                    function (err, objs) {
                        adb.queryAssets(
                            null,
                            self.type,
                            function (err, results) {
                                callback(objs, results);
                            }
                        );
                    });
            },

            jumpRes(uuid) {
                Editor.Ipc.sendToAll('assets:hint', uuid);
                Editor.Selection.select('asset', uuid, true);
            },

            onDeleteClick(url) {
                let picUrl = this.getPicUrl(url);
                this.deleteRes([picUrl], this.items);
            },

            onDeleteAllClick() {
                let urlArr = [];
                for (let i = 0; i < this.items.length; i++) {
                    let picUrl = this.getPicUrl(this.items[i].url);
                    Editor.assetdb.remote.exists(picUrl) ? urlArr.push(picUrl) : '';
                }
                this.deleteRes(urlArr, this.items);
                Editor.log("删除全部成功！");
            },

            getPicUrl(url) {
                let adb = Editor.assetdb;
                let meta = adb.remote.loadMeta(url);
                let picUrl = adb.remote.uuidToUrl(meta.rawTextureUuid);
                return picUrl;
            },

            /**
             * 
             * @param {String} str 
             */
            splitInput(str) {
                if (!str) {
                    return [];
                }
                return str.split(',');
            },

            goHub() {
                cp.exec('start https://github.com/shpz/CreatorClean/blob/master/README.MD');
            },

            deleteRes(url, items) {
                let self = this;
                let adb = Editor.assetdb;
                if (url.length > 1) {
                    this.refresh();
                }
                else {
                    let index = items.findIndex(function (item, index) {
                        return self.getPicUrl(item.url) == url[0];
                    });
                    index == -1 ? '' : items.splice(index, 1);
                }
                adb.delete(url);
                // this.refresh();
            },
        }
    });
};

Editor.Panel.extend({
    template: Fs.readFileSync(PATH.html, 'utf-8'),
    style: Fs.readFileSync(PATH.style, 'utf-8'),

    $: {
        'warp': '#warp'
    },

    ready() {
        this.vm = createVM(this.$warp);
        this.vm.ignore = FFs.readJsonSync(PATH.ignore);
        this.vm.refresh();
    },

    // ipc
    messages: {
        'scene:ready'() {
        }
    }
});

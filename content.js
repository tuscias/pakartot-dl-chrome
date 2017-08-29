var albumInfo = {};


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    var url = request.url;
    var marker = '<a id="pakartot-downloader" url="' + url + '"></a>';

    if (!$('a#pakartot-downloader').length ) {
        $('body').append(marker);
    } else if (url.indexOf($('a#pakartot-downloader').attr('url')) != -1) {
        return;
    } else {
        $('a#pakartot-downloader').replaceWith(marker);
    };

    var albumId = $('div.album-controls').find("a.play-release").attr('data-id');

    getAlbumInfo(albumId).then(data => {
        albumInfo = data;
        injectDownloadButtons(albumId);
    });
});


function injectDownloadButtons(albumId) {
    // Icons
    var waitIconUrl = chrome.extension.getURL('images/wait.png');
    var downloadIconUrl = chrome.extension.getURL('images/download.png');

    // Resize page to fit icons
    var headerDiv = $('div#header');
    headerDiv.css('width', headerDiv.width() + 30);

    var top2LeftDiv = $('div#top2-left');
    top2LeftDiv.css('width', top2LeftDiv.width() + 30);

    var contentDiv = $('div#content');
    contentDiv.css('width', contentDiv.width() + 70);

    var rightColumnDiv = $('div#content > div.right_column');
    rightColumnDiv.css('width', rightColumnDiv.width() + 30);

    // Add 'Download Album' button

    var downloadAlbumButton = $('<a id="downloadAlbum" title="Siųsti albumą"><img src="' + downloadIconUrl + '"/></a>').attr('href', '#').bind('click', { 'id': albumId }, downloadAlbum);
    $('div.album-controls').append(downloadAlbumButton);

    // Add 'Download Track' button
    $('div.homepage_track_list > .item')
        .not('.item-header').
        each(function (index) {
            var trackId = $(this).find(".play > a").attr('data-id');
            var downloadTrackButton = $('<a id="downloadTrack-"' + index + ' title="Siųstis Dainą" style="padding-left:5px"><img style="width:20px; height: 20px" src="' + downloadIconUrl + '"/></a>').attr('href', '#');
            downloadTrackButton.bind('click', { 'id': trackId }, downloadTrack);
            $(this).append(downloadTrackButton);
    });
}

function downloadAlbum(event) {
    event.preventDefault();
    toggleLoading();

    var id = event.data.id;
    var tracks = albumInfo['tracks'];
    var dlPromises = [];

    for (var i = 0; i < tracks.length; i++) {
        var filename = ('0' + (i+1)).slice(-2) + '_' + slugify(tracks[i]['performers']) +'_' + slugify(tracks[i]['track_name']) + '.mp3';

        dlPromises.push(doDownload(tracks[i]['filename'], filename, tracks[i]));
    };

    var zip = new JSZip();
    var artist = albumInfo['album']['performers'];
    var albumName = albumInfo['album']['album_name'];
    var zipfileName = slugify(artist) + '_' + slugify(albumName) + '.zip';

    Promise.all(dlPromises).then(function(values) {
        var wTagPromises = values.map(function (item) {
            var tags = makeTrackTags(item.info);

            return writeTrackTags(item.content, tags).then(function (content) {
                zip.file(item.filename, content, {binary: true});
            });
        });

        Promise.all(wTagPromises).then(function(values) {
            zip.generateAsync({type:"blob"}).then(function(content) {
                saveAs(content, zipfileName);
                toggleLoading();
            });
        });
    });
}

function downloadTrack(event) {
    event.preventDefault();
    toggleLoading();

    var trackId = event.data.id;
    var tracks = albumInfo['tracks'];

    for (var i = 0; i < tracks.length; i++) {
        if (tracks[i]['track_id'] != trackId)
            continue;

        var filename = slugify(albumInfo['album']['performers']) + '_' + slugify(tracks[i]['track_name']) + '.mp3';
        doDownload(tracks[i]['filename'], filename).then(function (item) {
            var tags = makeTrackTags(tracks[i]);

            writeTrackTags(item.content, tags).then(function (fileContent) {
                saveAs(fileContent, item.filename);
                toggleLoading();
            });
        });

        break;
    }
}

// Helper functions

function getAlbumInfo(albumId) {
    var baseParams = {username: 'publicUSR', password: 'vka3qaGHowofKcRdTeiV'};

    return new Promise((resolve, reject) => {
        var params = {url: 'album', id: albumId};

        for (var attrname in baseParams) {
            params[attrname] = baseParams[attrname];
        }

        $.post('https://api.pakartot.lt/', params, response => {
            var albumData = $.parseJSON(response);

            var params = {url: 'play', action:'album', id: albumId};
            for (var attrname in baseParams) {
                params[attrname] = baseParams[attrname];
            }

            $.post('https://api.pakartot.lt/', params, response => {
                var tracksData = $.parseJSON(response);

                for (var i = 0; i < tracksData['tracks'].length; i++) {
                    for (var j = 0; j < albumData['tracks'].length; j++) {
                        if (albumData['tracks'][j]['track_id'] == tracksData['tracks'][i]['tid']) {
                            albumData['tracks'][j]['filename'] = tracksData['tracks'][i]['filename'].replace('api.php', 'mp3.php');
                            break;
                        }
                    }
                }
                resolve(albumData);
            });
        });
    });
}

function convertBlobToArrayBuffer(blob) {
    return new Promise(function (resolve, reject) {
        var arrayBuffer;
        var fileReader = new FileReader();

        fileReader.onload = function() {
            arrayBuffer = this.result;
            resolve(arrayBuffer);
        };

        fileReader.onerror = function(e) {
            reject(e);
        }
        arrayBuffer = fileReader.readAsArrayBuffer(blob);
    });
}

function makeTrackTags(trackInfo) {
    return {
        'TALB': albumInfo['album']['album_name'],
        'TPE1': [trackInfo['performers']],
        'TIT2': trackInfo['track_name'],
        'TLEN': trackInfo['track_length'] + '000',
        'TYER': trackInfo['track_year'],
        'TRCK': trackInfo['album_track_order'] + '/' + albumInfo['tracks'].length,
        'WCOP': 'Lietuvos gretutinių teisių asociacija AGATA',
        'COMM': {'description': 'Šaltinis: https://wwww.pakartot.lt', 'text': 'Šaltinis: https://wwww.pakartot.lt'}
    }
}

function writeTrackTags(blob, tags) {
    return new Promise(function (resolve, reject) {
        convertBlobToArrayBuffer(blob).then(function (arrayBuffer) {
            const writer = new ID3Writer(arrayBuffer);

            for (var frameName in tags) {
                writer.setFrame(frameName, tags[frameName]);
            }

            writer.addTag();
            resolve(writer.getBlob());
        })
    });
}

function toggleLoading() {
    $("div#blocker").toggle();
}

function doDownload(url, filename, info, done) {
     return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();

        xhr.responseType = 'blob';
        xhr.open('GET', url);

        xhr.onload = function() {
            resolve({'filename': filename, 'content': this.response, 'info': info});
        }

        xhr.onerror = function () {
            reject(xhr.response)
        }
        xhr.send();
    });
}

function slugify(text)
{
  return text.toString().toLowerCase()
    .replace(/^\s+|\s+$/g, '')        // .strip()
    .replace(/\s+/g, '-')           // Replace spaces with -
    //.replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    //.replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}


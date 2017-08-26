// Icons
var waitIconUrl = chrome.extension.getURL('images/wait.png');
var downloadIconUrl = chrome.extension.getURL('images/download.png');

// Resize page to fit icons
var headerDiv = $('div#header');
headerDiv.css('width', headerDiv.width() + 60);

var top2LeftDiv = $('div#top2-left');
top2LeftDiv.css('width', top2LeftDiv.width() + 60);

var contentDiv = $('div#content');
contentDiv.css('width', contentDiv.width() + 100);

var rightColumnDiv = $('div#content > div.right_column');
rightColumnDiv.css('width', rightColumnDiv.width() + 30);

// Add 'Download Album' button
var albumId = $('div.album-controls').find("a.play-release").attr('data-id');
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


function downloadAlbum(event) {
    var id = event.data.id;
    toggleLoading();

    $.post("/api/backend/frontend/player/play.php", {'type':'aid','id': id}, function( response ) {
        var data = $.parseJSON(response);

        var promises = [];
        for (var i = 0; i < data.info.length; i++) {
            var albumItem = data.info[i];
            var filename = ('0' + (i+1)).slice(-2) + ' - ' + slugify(albumItem.title) + '.mp3';

            promises.push(downloadBlob(albumItem.filename, filename));
        }

        var zip = new JSZip();
        var albumName = new URI(data.info[0].album_link).segment(-1);

        Promise.all(promises).then(function(values) {
            for (var i = 0; i < values.length; i++) {
                var item = values[i];
                zip.file(item.filename, item.content, {binary: true});
            };

            zip.generateAsync({type:"blob"}).then(function(content) {
                saveAs(content, albumName + '.zip');
                toggleLoading();
            });
        });
    });
}

function downloadTrack(event) {
    var id = event.data.id;
    toggleLoading();

    $.post("/api/backend/frontend/player/play.php", {'type':'tid','id': id}, function( response ) {
        var data = $.parseJSON(response);
        var filename = data.info.title + '.mp3';

        downloadBlob(data.info.filename, filename).then(function (item) {
            console.log(item);
            saveAs(item.content, item.filename);
            toggleLoading();
        });
    });
}


// Helper functions

function toggleLoading() {
    $("div#blocker").toggle();
}


function downloadBlob(url, filename, done) {
     return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'blob';
        xhr.open('GET', url);

        xhr.onload = function() {
            resolve({'filename': filename, 'content': this.response});
        }

        xhr.onerror = function () {
            reject(xhr.response)
        }
        xhr.send();
    });

    xhr.send();
}


function slugify(text)
{
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}



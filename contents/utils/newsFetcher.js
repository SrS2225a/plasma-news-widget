function getAttributeValue(node, attributeName) {
    if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i++) {
            if (node.attributes[i].name === attributeName) {
                return node.attributes[i].value;
            }
        }
    }
    return "";
}

function getTextContent(node) {
    return node && node.firstChild ? node.firstChild.nodeValue : "";
}


// for whatever reason XML DOM tree currently supported by QML is a reduced subset of the DOM Level 3 Core API,
// so we have to manually parse the XML document to extract the news items. WTF QML?
function fetchNews(rssUrl, callback) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = "document"; // Ensure response is parsed as XML
    console.log("Fetching news from " + rssUrl);
    xhr.open("GET", rssUrl);

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                var xmlDoc = xhr.responseXML;

                if (!xmlDoc || !xmlDoc.documentElement) {
                    callback([], "Failed to parse XML document");
                    return;
                }

                var newsArray = [];
                var channel = null;
                var rootChildren = xmlDoc.documentElement.childNodes;
                
                // Find the <channel> element in the root's child nodes
                for (let i = 0; i < rootChildren.length; i++) {
                    if (rootChildren[i].nodeName === "channel") {
                        channel = rootChildren[i];
                        break;
                    }
                }
                
                if (!channel) {
                    callback([], "No <channel> element found in RSS feed");
                    return;
                }

                // Parse <title> to find the feed title
                var feedTitle = "Unknown Feed";
                var titleNode = channel.firstChild;
                while (titleNode) {
                    if (titleNode.nodeName === "title") {
                        feedTitle = getTextContent(titleNode);
                        break;
                    }
                    titleNode = titleNode.nextSibling;
                }

                // Parse <item> elements for the news articles
                var itemNode = channel.firstChild;
                while (itemNode) {
                    if (itemNode.nodeName === "item") {
                        var title = "No title";
                        var link = "#";
                        var description = "No description";
                        var pubDate = "No date";
                        var imageUrl = "";

                        // Parse the <item> node and its children
                        var itemChildren = itemNode.childNodes;
                        for (let i = 0; i < itemChildren.length; i++) {
                            var childNode = itemChildren[i];

                            switch (childNode.nodeName) {
                                case "title":
                                    title = getTextContent(childNode);
                                    break;
                                case "link":
                                    // if the link is already set for the item, don't overwrite it
                                    if (link === "#") {
                                        link = getTextContent(childNode);
                                    }
                                    break;
                                case "description":
                                    description = getTextContent(childNode);
                                    break;
                                case "pubDate":
                                    pubDate = getTextContent(childNode);
                                    break;
                                case "thumbnail":
                                case "enclosure":
                                case "content":
                                    imageUrl = getAttributeValue(childNode, "url");
                                    break;
                                case "media:group":
                                    var mediaChild = childNode.firstChild;
                                    while (mediaChild) {
                                        if (mediaChild.nodeName === "media:content") {
                                            imageUrl = getAttributeValue(mediaChild, "url");
                                            break;
                                        }
                                        mediaChild = mediaChild.nextSibling;
                                    }
                                    break;
                            }
                        }

                        newsArray.push({
                            title: title,
                            link: link,
                            description: description,
                            pubDate: pubDate,
                            imageUrl: imageUrl
                        });
                    }
                    itemNode = itemNode.nextSibling;
                }

                // Return the fetched feed with title and items
                if (newsArray.length === 0) {
                    callback([], "No news articles found in the feed.");
                } else {
                    callback({ url: rssUrl, title: feedTitle, items: newsArray }, "");
                }
            } else {
                callback([], "Failed to load RSS feed (HTTP Status " + xhr.status + ")");
            }
        }
    };

    xhr.send();
}

function fetchAllFeeds(feedUrls, callback) {
    var allFeeds = [];
    var errors = [];
    var remaining = feedUrls.length;

    feedUrls.forEach(rssUrl => {
        fetchNews(rssUrl, (feedData, errorMessage) => {
            if (errorMessage) errors.push(`Error fetching ${rssUrl}: ${errorMessage}`);
            else allFeeds.push(feedData);

            if (--remaining === 0) callback(allFeeds, errors.length ? errors.join("\n") : "");
        });
    });
}
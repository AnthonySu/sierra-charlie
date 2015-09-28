"use strict";

/* global Path2D */

var defs = require("./defs");
var iid = require("./image-id");
var tid = require("./tile-id");


module.exports = {
  componentDidMount: function () {
    this.queuedImageIds = [];
    this.renderedImages = {};
    this.renderedGroups = {};
  },

  componentWillUnmount: function () {
    clearTimeout(this.pendingRender);
    clearTimeout(this.pendingQueueToRender);
  },

  setRenderedImage: function (imageId, flag) {
    this.renderedImages[imageId] = flag;
  },

  getRenderedImage: function (imageId) {
    return this.renderedImages[imageId];
  },

  setRenderedGroup: function (groupId, canvas) {
    this.renderedGroups[groupId] = canvas;
  },

  getRenderedGroup: function (groupId) {
    return this.renderedGroups[groupId];
  },

  renderRoadLinks: function (c, zoomLevel, tileData) {
    if (!tileData.roadLinksPath) {
      tileData.roadLinksPath = new Path2D(tileData.roadLinksSvgData);
    }
    c.lineWidth = 2 * Math.sqrt(zoomLevel) * (defs.tileSize / defs.imageSize);
    c.strokeStyle = defs.roadLinkColor;
    c.stroke(tileData.roadLinksPath);
  },

  renderRoadNodes: function (c, zoomLevel, tileData) {
    var nodeSize = 8 * Math.sqrt(zoomLevel) * (defs.tileSize / defs.imageSize);
    c.fillStyle = defs.roadNodeColor;
    for (var i = 0; i < tileData.roadNodes.length; i++) {
      var p = tileData.roadNodes[i].p;
      c.fillRect(p.x - nodeSize / 2, p.y - nodeSize / 2, nodeSize, nodeSize);
    }
  },

  renderImage: function (imageId) {
    var tileId = iid.toTileId(imageId);
    var tileData = this.getLoadedTile(tileId);
    var zoomPower  = iid.getZoomPower(imageId);
    var zoomLevel  = Math.pow(2, zoomPower);
    var groupCount = zoomLevel;
    var imageSize  = window.devicePixelRatio * defs.imageSize / zoomLevel;
    var groupSize  = imageSize * groupCount;
    var gx = Math.floor(iid.getLocalX(imageId) / groupCount) * groupCount;
    var gy = Math.floor(iid.getLocalY(imageId) / groupCount) * groupCount;
    var groupId = iid.fromLocal(gx, gy, zoomPower);
    var canvas = this.getRenderedGroup(groupId);
    var c;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width  = groupSize;
      canvas.height = groupSize;
      c = canvas.getContext("2d");
      c.scale(imageSize / defs.tileSize, -imageSize / defs.tileSize);
      c.translate(-defs.localToTileX(gx) * defs.tileSize, -defs.localToTileY(gy - 1) * defs.tileSize);
      this.setRenderedGroup(groupId, canvas);
    } else {
      c = canvas.getContext("2d");
    }
    c.globalCompositeOperation = "screen";
    this.renderRoadLinks(c, zoomLevel, tileData);
    this.renderRoadNodes(c, zoomLevel, tileData);
    c.globalCompositeOperation = "source-over";
    this.setRenderedImage(imageId, true);
  },

  renderNextImage: function () {
    var pendingImageId;
    while (this.queuedImageIds.length) {
      var imageId = this.queuedImageIds.pop();
      if (!this.getRenderedImage(imageId)) {
        pendingImageId = imageId;
        break;
      }
    }
    if (pendingImageId) {
      this.renderImage(pendingImageId);
      this.requestPainting();
      this.requestRenderingImages();
    }
  },

  requestRenderingImages: function () {
    clearTimeout(this.pendingRender);
    this.pendingRender = setTimeout(this.renderNextImage, 0);
  },

  queueVisibleImagesToRender: function () {
    var easedZoomPower = this.getEasedZoomPower();
    var floorZoomPower = Math.floor(easedZoomPower);
    var ceilZoomPower  = Math.ceil(easedZoomPower);
    var imageIds = [];
    this.spirally(function (lx, ly) {
        if (this.isTileVisible(lx, ly)) {
          var tileId = tid.fromLocal(lx, ly);
          if (this.getLoadedTile(tileId)) {
            var floorImageId = iid.fromTileId(tileId, floorZoomPower);
            if (!this.getRenderedImage(floorImageId)) {
              imageIds.push(floorImageId);
            }
            if (floorZoomPower !== ceilZoomPower) {
              var ceilImageId = iid.fromTileId(tileId, ceilZoomPower);
              if (!this.getRenderedImage(ceilImageId)) {
                imageIds.push(ceilImageId);
              }
            }
          }
        }
      }.bind(this));
    this.queuedImageIds = imageIds.reverse();
    this.requestRenderingImages();
  },

  requestQueueingVisibleImagesToRender: function () {
    clearTimeout(this.pendingQueueToRender);
    this.pendingQueueToRender = setTimeout(this.queueVisibleImagesToRender, 0);
  }
};

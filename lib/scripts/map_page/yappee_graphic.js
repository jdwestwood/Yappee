// code for generating the Yappee logo animation
makeYappeeGraphic();

function makeYappeeGraphic() {
// generate the Yappee graphic and add the HTML using d3js; do not display it until after the page has finished
// loading and the jQuery document load is triggered.

  function YappeeNode(x, y, color) {
  // constructor for a node in a letter in the Yappee graphic
    var dp = 4;
    this.x = x;
    this.y = y;
    this.plotX = this.x + Math.floor( (2*dp + 1)*Math.random() ) - dp;   // random pixel offset up to +/- dp pixels
    this.plotY = this.y + Math.floor( (2*dp + 1)*Math.random() ) - dp;   // random pixel offset up to +/- dp pixels
    this.startX = 8 + Math.floor((305 - 2*8)*Math.random());
    this.startY = 8 + Math.floor((80 - 2*8)*Math.random());
    this.color = color;
  }

  function YappeeLine(node1, node2, color) {
  // constructor for a line in a letter in the Yappee graphic
    this.node1 = node1;
    this.node2 = node2;
    this.color = color;
  }

  function YappeeText(x, y, text) {
  // constructor for text that appears in the Yappee graphic
    this.x = x;
    this.y = y;
    this.text = text;
  }

  var L = 90, C = 20;
  var nColor = 7, dColor = 0.40;
  var palette = getRandomHCLPalette(nColor, dColor, L, C);
  var midColor = palette.HCL[Math.floor(nColor/2)];
  var lineColor = d3.hcl(midColor.h, midColor.c - 15, midColor.l + 2);

  var yappeeLists = makeYappeeLists(palette, lineColor);
  addYappeeSVG(yappeeLists.nodes, yappeeLists.lines, yappeeLists.text);

  function getRandomHCLPalette(nColor, dColor, L, C) {
  // will generate a palette of nColor colors spaced dColor increments apart in the Hue dimension at Lightness L
  // and Chroma C;
  // use Java applet at http://dcssrv1.oit.uci.edu/~wiedeman/cspace/me/rgbciehsv.html to choose Lightness and Chroma
  // values that work for all Hues from 0-360 deg; note that many combinations of HCL values do not produce valid
  // RGB values; when this happens; d3.hcl(H, C, L).rgb() changes any negative RGB values to 0 and any that are > 255 to 255.
    var H = Math.floor(360*Math.random());
    var dTheta = (360/2*3.1416)*dColor/C;
    var paletteHCL = [], paletteRGB = [];
    for (var i = 0; i < nColor; i++) {
      paletteHCL[i] = d3.hcl(H + i*dTheta, C, L);
      paletteRGB[i] = paletteHCL[i].toString();
    }
    return {HCL: paletteHCL, RGB: paletteRGB};
  }

  function makeYappeeLists(palette, lineColor) {
  // prepare the yappeeNodes and yappeeLines for the Yappee graphic; the nodes use the palette.RGB colors randomly
  // selected in groups for each letter
    var yappeeNodes = [];
    var yappeeLines = [];
    var yappeeText = [];

    makeText([[28, 38, "Yet Another Patent PErusEr"]]);

    // Y
    palette.RGB = _.shuffle(palette.RGB);
    var nodesY = makeNodes([[13, 13, palette.RGB[0]], [26, 40, palette.RGB[1]],
                            [18, 67, palette.RGB[2]], [53, 13, palette.RGB[3]]])
    makeLines(nodesY, [[0, 1, lineColor], [1, 2, lineColor], [1, 3, lineColor]]); 

    // A
    palette.RGB = _.shuffle(palette.RGB); 
    var nodesA = makeNodes([[78, 13, palette.RGB[0]], [60, 40, palette.RGB[1]], [42, 67, palette.RGB[2]],
                            [82, 40, palette.RGB[3]], [85, 67, palette.RGB[4]]])
    makeLines(nodesA, [[0, 1, lineColor], [1, 2, lineColor], [0, 3, lineColor], [3, 4, lineColor], [1, 3, lineColor]]); 

    // P
    palette.RGB = _.shuffle(palette.RGB); 
    var nodesP1 = makeNodes([[117, 13, palette.RGB[0]], [112, 40, palette.RGB[1]], [107, 67, palette.RGB[2]],
                            [142, 19, palette.RGB[3]], [138, 40, palette.RGB[4]]])
    makeLines(nodesP1, [[0, 1, lineColor], [1, 2, lineColor], [0, 3, lineColor], [3, 4, lineColor], [4, 1, lineColor]]); 

    // P
    palette.RGB = _.shuffle(palette.RGB); 
    var nodesP2 = makeNodes([[166, 13, palette.RGB[0]], [161, 40, palette.RGB[1]], [156, 67, palette.RGB[2]],
                            [191, 19, palette.RGB[3]], [187, 40, palette.RGB[4]]])
    makeLines(nodesP2, [[0, 1, lineColor], [1, 2, lineColor], [0, 3, lineColor], [3, 4, lineColor], [4, 1, lineColor]]); 

    // E
    palette.RGB = _.shuffle(palette.RGB); 
    var nodesE1 = makeNodes([[215, 13, palette.RGB[0]], [210, 40, palette.RGB[1]], [205, 67, palette.RGB[2]],
                            [242, 13, palette.RGB[3]], [233, 40, palette.RGB[4]], [232, 67, palette.RGB[5]]])
    makeLines(nodesE1, [[0, 1, lineColor], [1, 2, lineColor], [0, 3, lineColor], [1, 4, lineColor], [2, 5, lineColor]]); 

    // E
    palette.RGB = _.shuffle(palette.RGB); 
    var nodesE2 = makeNodes([[265, 13, palette.RGB[0]], [260, 40, palette.RGB[1]], [255, 67, palette.RGB[2]],
                            [292, 13, palette.RGB[3]], [283, 40, palette.RGB[4]], [282, 67, palette.RGB[5]]])
    makeLines(nodesE2, [[0, 1, lineColor], [1, 2, lineColor], [0, 3, lineColor], [1, 4, lineColor], [2, 5, lineColor]]); 

    return {"nodes": yappeeNodes, "lines": yappeeLines, "text": yappeeText};

    function makeNodes(nodeParamList) {
    // make yappee letter nodes whose parameters are in the nodeParamList Array; each element nodeParamList[i] is a list
    // containing the initialization parameters for the YappeeNode class containing [.x, .y, .color] for the i'th node
      var nodeList = [];
      for (var i = 0; i< nodeParamList.length; i++) {
        var initList = nodeParamList[i];
        var node = new YappeeNode(initList[0], initList[1], initList[2]);
        yappeeNodes.push(node);
        nodeList.push(node);
      }
      return nodeList;
    }

    function makeLines(nodes, connections) {
    // make yappee letter line segments between the YappeeNode 'nodes' list with node connections listed in
    // the 'connections' array; each element in the 'connections' array is a list of initialization parameters
    // for the YappeeLine class containing [nodes index 1, nodes index 2, line color].
      for (var i = 0; i < connections.length; i++) {
        var initList = connections[i];
        var node1Index = initList[0];
        var node2Index = initList[1];
        var lineColor = initList[2];
        yappeeLines.push(new YappeeLine(nodes[node1Index], nodes[node2Index], lineColor));
      }
    }

    function makeText(wordList) {
    //  make the list of YappeeText objects that will be added to the Yappee logo; wordList is a list of YappeeText
    //  object initialization parameter lists: [.x, .y, .text].
      for (var i = 0; i < wordList.length; i++) {
        var initList = wordList[i];
        yappeeText.push(new YappeeText(initList[0], initList[1], initList[2]));
      }
    }
  }

  function addYappeeSVG(yappeeNodes, yappeeLines) {
    var svgYap = d3.select("svg.yappee-graphic");
    // add letter segment lines first so nodes plot on top of them; set them at their final position with opacity 0;
    // we will transition them to opaque after the document is ready so the transition runs smoothly.
    svgYap.selectAll("line.yappee-line").data(yappeeLines).enter()
          .append("svg:line").classed({"yappee-line": true})
          .attr({"x1": function(d) {return d.node1.plotX;},
                 "y1": function(d) {return d.node1.plotY;},
                 "x2": function(d) {return d.node2.plotX;},
                 "y2": function(d) {return d.node2.plotY;}})
          .style({"stroke": function(d) {return d.color},
                  "visibility": "hidden",
                  "opacity": 0});

   // add letter nodes; set them at randomly chosen initial coordinates, but make them transparent until the document
   // is ready so the transition runs smoothly.
   svgYap.selectAll("circle.yappee-circle").data(yappeeNodes).enter()
         .append("svg:circle").classed({"yappee-circle": true})
         .attr({"r": 7})
         .style({"fill": function(d) {return d.color;},
                 "visibility": "hidden"});

   var yapText = svgYap.append("svg:text").classed({"yappee-text": true})
         .attr({"x": 30, 
                "y": 38})
         .style({"visibility": "hidden"});
   yapText.append("svg:tspan").text("Y").classed({"yappee-text-highlight": true});
   yapText.append("svg:tspan").text("et ");
   yapText.append("svg:tspan").text("A").classed({"yappee-text-highlight": true});
   yapText.append("svg:tspan").text("nother ");
   yapText.append("svg:tspan").text("P").classed({"yappee-text-highlight": true});
   yapText.append("svg:tspan").text("atent ");
   yapText.append("svg:tspan").text("PE").classed({"yappee-text-highlight": true});
   yapText.append("svg:tspan").text("rus");
   yapText.append("svg:tspan").text("E").classed({"yappee-text-highlight": true});
   yapText.append("svg:tspan").text("r");
 }
}


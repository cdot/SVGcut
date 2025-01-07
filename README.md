# SVG2Gcode

A simple CAM package that runs in the browser. It takes SVG (Scalable Vector Graphics) files as inputs, and generates Gcode under interactive control.

SVG2Gcode is a fork of Tim Fleming's jscut, which is largely undocumented and has been unsupported since 2014.

## Preparing your SVG

To prepare your SVG, make sure draw it at the size that you want your final work to be. If you are using Inkscape, then set your units to whatever physical measure you feel most comfortable with (usually millimetres or inches) and simply draw at that scale. It is easiest, though not essential, to set your page size to the area that your CNC machine can handle.
+ SVG2Gcode can only handle closed paths.
++ You may have to use the "Path->Object to Path" command to convert some objects (such as text) into paths.
++ Simple unclosed paths (such as lines or arcs) can't be machined, so don't use them.
+ Colour is ignored, so beware of creating paths the same colour as their background!
+ Stroke width is also ignored as well, so you are recommended to set a very small stroke width.

If you have a drawing that makes heavy use of complex features (such as text,
or shapes, or meshes) you might consider taking a copy and preparing it for machining, rather than converting your original to paths and losing all the nice features.

Load SVG2Gcode in your browser, and select "Open SVG" from the toolbar to open your SVG file.

## Tool

The next thing to have to do is to set up the tool you are using on the "Tool" pane. There is popup help on each of the options.

## Material

Now specify the material you are working with. There is popup help on each of the options.

## Operations

Use the mouse to select the paths you want to convert to Gcode. They will turn blue. In the "Operations" pane, click "Create Operation" to tell it what you want to do with the selected paths. There are four operations available:
+ Pocket - the default, will carve out the interior of your selected paths
+ Inside - will cut around the inside of the selected paths
+ Outside - will cut around the outside of the selected path
+ Engrave - the tool will follow the selected paths
When you change the operation, you will see the path that the tool will take overlaid on your SVG. You can see which paths an operation applies to by selecting/deselecting the operation while watching the SVG window.

### Plunge versus Ramp
See <a href="https://www.harveyperformance.com/in-the-loupe/ramping-success/">here</a> for an excellent explanation.

### Conventional versus Climb
See <a href="https://www.harveyperformance.com/in-the-loupe/conventional-vs-climb-milling/">here</a> for an excellent explanation.

## Gcode Conversion

You are now ready to generate Gcode. In the Gcode pane, select the units that your machine operates in. If your machine supports the G21 code, you can just the units you are most comfortable in.

When you draw in an SVG editor such as Inkscape, you work in a coordinate system where 0, 0 is at the top left of the page, and Y increases downwards. Hobbyist CNC machine coordinates, however, usually work from an origin at the bottom left, with Y increasing away from the operator, and SVG2Gcode assumes this.

The application handles most of the details of converting between these coordinate systems. However it helps if you have to have a clear idea of how the different systems relate.

+ SVG Coordinates - 0,0 is at the top left of the page. Y increases downwards.
+ The Machine Origin - 0,0 is the bottom left corner of the work area. All CNC machines have a coordinate origin, normally determined automatically by running each axis against the end stops.

You can choose for the machine origin to correspond to the bottom left of the SVG page, or to the bottom left of the bounding box around your selected operations. For example, let's say we want to carve the Sanskrit word "Love". We have drawn it on a 80x60mm page. The top left corner of the bounding box of the drawing is at (10,15)mm while the bottom right corner is at (70,45)mm, as shown by the green lettering.

![Coordinates](coords.svg "Coordinates")

When we load up SVG2Gcode and generate Gcode for this drawing with the "Machine Origin set to "SVG Page", then the lower left corner of the SVG page becomes machine (0,0) and the lower left corner of the bounding box will be at machine (10,30), as shown by the orange letters.

If we now switch the machine origin to "Bounding Box", then the lower left corner of the bounding box becomes machine (0,0), and the top right is (60,30), as shown by the magenta letters.

As well as the "SVG page" and "Bounding box" origins, you can also generate Gcode to add an additional offset to the origin. For example, if you want to move the machine origin several times and repeat the same cut. This is achieved using G codes - you are recommended to read [The Machining Doctor](https://www.machiningdoctor.com/gcodes/g54/) for more.

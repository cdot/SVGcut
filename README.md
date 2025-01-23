# <img src="/images/logo.svg" style="display:inline;width:32px;height:32px" /> SVGcut

A simple Computer Aided Manufacturing (CAM) application that runs in
the browser. It takes SVG (Scalable Vector Graphics) files as inputs,
and generates Gcode under interactive control. You can then save the
Gcode for sending to your CNC machine using an application such as
[Candle](https://github.com/Denvi/Candle). It is primarily aimed at
hobbyist milling machines (routers), and doesn't support many of the
capabilities of more sophisticated machines, such as tool swapping.

No need to install anything, you can
[run it in your browser](https://cdot.github.io/SVGcut/app.html).

SVGcut is tested with Inkscape 133.0.3, Inkscape 1.4, Candle2, and a
SainSmart Genmitsu 3018-PRO Router. If you want to contribute to
development, see [DEVELOPING](DEVELOPING.md).

## Preparing your SVG

To prepare your SVG, make sure draw it at the size that you want your
final work to be. If you are using Inkscape, then set your units to
whatever physical measure you feel most comfortable with (usually
millimetres or inches) and simply draw at that scale. It is easiest,
though not essential, to set your page size to the area that your CNC
machine can handle. Make sure that the Scale (in Document Properties)
is set to 1.

There are some limitations:
- SVGcut can only handle closed paths.
    - You may have to use the "Path->Object to Path" command to convert some objects (such as text) into paths.
    - Simple unclosed paths (such as lines or arcs) aren't supported, so don't use them.
- Colour is ignored, so beware of creating paths the same colour as their background.
- Stroke width is also ignored, so you are recommended to set a very small stroke width.

*Tip* If you have a drawing that makes heavy use of complex features
(such as text, or shapes, or meshes) you might consider taking a copy
and preparing it for machining, rather than converting your original
to paths and losing all the nice features.

Load SVGcut in your browser.

## Tool

The next step is to set the parameters of the tool you are
using. Click on the `Tool Settings` button to open the settings
pane. There is popup help on each of the options.

## Material

Open the material pane to specify the material you are working
with. There is popup help on each of the options.

## Import SVG

Open the `Project` menu and select `Import SVG` to load your SVG
file. If you have more than one SVG file you can load them all at
once, or one after another.

## Operations

Use the mouse to select the paths (the _geometry_) you want to convert
to Gcode (click a path again to deselect it; a double-click will
select all paths). They will change colour. In the `Operations` pane,
click `Create Operation` to tell it what you want to do with the
selected paths. There are a number of operations available:
+ `Engrave` - the tool will follow the selected paths (basically what a pen plotter does).
+ `Outside` - will cut around the outside of the selected paths.
+ `Inside` - will cut around the inside of your paths.
+ `Pocket (concentric)` - will carve out the interior of your selected paths using ever-decreasing circles.
+ `Pocket (raster)` - will carve out the interior of your selected paths using side-to-side tool movements.
+ `Perforate` - will drill a series of evenly-spaced holes outside the boundary of the selected paths. You can control the spacing of the holes.

The `Toolpaths` pane will change to show what has been selected for
the operation, and the tool paths generated for that operation.

Now you should set the depth to which you want your selected operation
to cut (it won't necessarily cut to this depth immediately, it may do
several passes in steps of the `Pass Depth` you set in the `Tool
Settings` pane). There are other options that can be set in the
drop-down that opens when you click ▶.
+ `Name` - by default operations are assigned a name that reflects the order they are added. You can personalise this here.
+ `Ramp Plunge` - Normally a deep cut is started by plunging the tool down into the work - by drilling a hole. Some tools or materials are not suitable for this, so a different approach is required. A ramp plunge is where the tool moves along the tool path while it also descends into the work. See <a href="https://www.harveyperformance.com/in-the-loupe/ramping-success/">here</a> for an excellent explanation.
+ `Combine` - specifies the boolean operation to apply to the selected paths.
+ `Direction`
    + `Conventional`, the cutter rotates against the direction of the feed.
    + `Climb`, the cutter rotates with the feed. See <a href="https://www.harveyperformance.com/in-the-loupe/conventional-vs-climb-milling/">here</a> for an excellent explanation.
+ `Margin` - this allows you to add a bit of extra space between the geometry and the tool path. You might need this for a second pass with a finishing tool.
+ `Width` - some operations can cut a path wider than the tool diameter.
+ `Spacing` - specific to the `Perforate` operation, this is used to set the spacing between drill holes.
Not all options are appropriate for all operations; the drop-down will
change when you change the selected operation, and so will the tool
paths shown in the display.

## Curve Conversion

Bezier curves in paths are supported by converting them to a sequence
of straight line segments. This pane give you some options for
controlling this conversion.

## Gcode Generation

In the `Gcode Generation` pane, select the units that your machine
operates in. If your machine supports the `G21` code you can just use
the units you are most comfortable in.

When you draw in an SVG editor such as Inkscape, you work in a
coordinate system where 0, 0 is at the top left of the page, and Y
increases downwards. However hobbyist CNC machine coordinates usually
work from an origin at the bottom left, with Y increasing away from
the operator, and this is the convention that SVGcut follows.

The application handles most of the details of converting between
these coordinate systems. However it helps if you have a clear idea of
how the different systems relate.

+ SVG Coordinates - 0,0 is at the top left of the page. Y increases downwards.
+ The Machine Origin - 0,0 is the bottom left corner of the work area. All CNC machines have a coordinate origin, normally determined automatically by running each axis against the end stops.

You can choose for the machine origin to correspond to the bottom left
of the SVG page, or to the bottom left of the bounding box around your
selected operations. For example, let's say we want to carve the
Sanskrit word "Love". We have drawn it on a 80x60mm page. The top left
corner of the bounding box of the drawing is at (10,15)mm while the
bottom right corner is at (70,45)mm, as shown by the green lettering.

<img src="/images/coords.svg" style="width:50%;height: auto"></img>

When we load up SVGcut and generate Gcode for this drawing with the
`Origin` set to `SVG Page`, then the lower left corner of the SVG page
becomes machine (0,0) and the lower left corner of the bounding box
will be at machine (10,30), as shown by the orange letters.

If we now switch the origin to `Bounding Box`, then the lower left
corner of the bounding box becomes machine (0,0), and the top right is
(60,30), as shown by the magenta letters.

If the origin is set to `Centre` then the centre of the bounding box
will be machine (0,0) while the bottom left corner will be at
(-30,-15).

As well as the "SVG page", "Bounding box", and "Centre", origins, you
can also generate Gcode to add an additional offset to the origin. For
example, if you want to move the machine origin several times and
repeat the same cut.

## Previewing the Gcode

### Simulator

At any point you can preview th Gcode in the `Simulate` pane. This
really is a Gcode simulator; it reloads the generated Gcode, and
displays the paths the tool will follow. Previewing is a good idea, as
it can help you pick up on cases where the tool diameter is too great
to cut an acute angle.

### Code preview

You can also use the `View Gcode` button in the `Gcode Generation`
pane to open
a text view on the Gcode.

## Saving the Gcode

Once you are happy with the Gcode save it to a file. You can call it
what you want, though if you use the extension `.nc` it will be easier
to find in Candle.

# Projects

The `Project` menu lets you save and reload projects. You can save in
a file, or in the browser.

When you start up the app for the first time, it starts up with a
bunch of defaults, many of which you will probably change to create
your own set of defaults. You can save these defaults for use in other
projects by selecting `Template only` when you save your project. If
you save a template called `default` in the browser, it will
automatically be loaded whenever you start up. You might have a number
of different tool configurations; you can save them the same way,
giving them meaningful names.

(Be warned; projects can be quite big, and the browser has limited
storage space, so keep the browser for templates and store project
files to disc.)

# Holding Tabs

To use
[holding tabs](https://www.axyz.com/technical-tip-of-the-week-when-to-use-holding-tabs/)
you have to draw paths in your SVG where you want the tabs to be. In
SVGcut, select these paths and use `Create Tabs` on the Tabs pane to
specify them as tabs. When the cutter passes over these areas, it will
be limited to cutting to the depth you specify.

# Relationship to `jscut`

SVGcut is a fork of
[Tim Fleming's `jscut`](https://github.com/tbfleming/jscut).
Development of `jscut` was abandoned over 10 years ago, leaving a number
of pull requests and issues unaddressed. SVGcut has fixes for some of
these, and more.
+ Support for saving and loading projects
+ Uses G0 rather than G1 for travel
+ Select all on a double-click
+ Easier to work with XY origins
+ Perforate operation
+ Gcode text preview
+ Extensive newbie documentation
+ Extensive in-code documentation and literate programming techniques
+ Clean ES6 Javascript
+ Updated third-party dependencies

Some features of `jscut` have been disabled/removed. This may be because
they are deemed too esoteric, or the (undocumented) code was too
complex to reverse engineer, for limited end-user value.
+ `V Pocket` operation. V cutting is a complex process with many variables, and there are many more powerful tools out there that can handle it.
- [Chilipeppr](http://www.chilipeppr.com/)
- [Google Drive](https://drive.google.com/)
- [Dropbox](https://www.dropbox.com/)
- [Github gists](https://gist.github.com/)
- The undocumented API

# LICENSE & COPYRIGHT

Tim Fleming is recognised as author of all his code, even where it has
been extensively rewritten. Because `jscut` is GPL, so is SVGcut.

+ Copyright 2014 Todd Fleming
+ Copyright 2024-2025 Crawford Currie

SVGcut is free software: you can redistribute it and/or modify it
under the terms of the GNU General Public License as published by the
Free Software Foundation, either version 3 of the License, or (at your
option) any later version.

SVGcut is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
for more details.

You should have received a copy of the GNU General Public License
along with SVGcut. If not, see <http://www.gnu.org/licenses/>.

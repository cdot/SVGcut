# <img src="/images/logo.svg" style="display:inline;width:32px;height:32px" /> SVGcut

<em>SVGcut is a fork of [`jscut`](https://github.com/tbfleming/jscut).
Development of `jscut` was abandoned in 2014, when the author moved on to other things.</em>

SVGcut is a simple Computer Aided Manufacturing (CAM) application that
runs in the browser. It takes SVG (Scalable Vector Graphics) files as
inputs, and generates [Gcode](https://en.wikipedia.org/wiki/G-code) under interactive control. You can then
save the Gcode for sending to your CNC machine using an application
such as [Candle](https://github.com/Denvi/Candle). It is primarily
aimed at hobbyist milling machines (routers), and doesn't support many
of the capabilities of more sophisticated machines, such as tool
swapping.

No need to install anything, you can
[run it in your browser](https://cdot.github.io/SVGcut/app.html).

SVGcut is tested with Firefox 134.0.0, Inkscape 1.4, Candle2, and a
SainSmart Genmitsu 3018-PRO Router. If you want to contribute to
development, see [DEVELOPING](DEVELOPING.md).

## Preparing your SVG

To prepare your SVG, make sure you draw you it at the size that you want your
final work to be. If you are using Inkscape, then set your units to
whatever physical measure you feel most comfortable with (usually
millimetres or inches) and simply draw at that scale. It is easiest,
though not essential, to set your page size to the area that your CNC
machine can handle. Make sure that the Scale (in Document Properties)
is set to 1.

There are some limitations:
- You may have to use the "Path↘Object to Path" command to convert some objects (such as text) into paths.
- Colour can be confusing. Beware of creating paths the same colour as their background, or that are covered by other objects.
- Stroke width is also ignored, so you are recommended to set a very small stroke width. Or set your stroke width to the width of the tool you are using, it can help you visualise the final result.

*Tip* If you have a drawing that makes heavy use of complex features
(such as text) you might consider taking a copy and preparing it for
machining, rather than converting your original to paths and losing
all the nice features.

<a href="https://cdot.github.io/SVGcut/app.html" target="_blank">Load SVGcut in your browser.</a>

## Tool

The next step is to set the parameters of the tool you are
using. Click on the `Tool Defaults` button to open the
pane. There is popup help on each of the options.

## Material

Open the `Material` pane to specify the material you are working
with. There is popup help on each of the options.

## Import SVG

Open the `File` menu and select `Import SVG` to load your SVG
file. If you have more than one SVG file you can load them all at
once, or one after another. You should be able to see your SVG in the main
window. You can zoom (mouse wheel) and pan (click and drag).

## Operations

Use the mouse to select the paths (the _geometry_) you want to convert
to Gcode (shift+click to select another, `Select↘All` to select everything).
They will change colour. In the `Operations` pane,
click `Create Operation` to tell it what you want to do with the
selected paths. There are a number of operations available, describedin detail in the popup help.

The display will change to show what has been selected for
the operation, and the tool paths generated for that operation.

Now you should set the depth to which you want your selected operation
to cut (it won't necessarily cut to this depth immediately, it may do
several passes in steps of the `Pass Depth`). There are other options
that can be set in the drop-down that opens when you click ▶. Some of these
options can be used to override the defaults set in the `Tool Settings` pane.

Not all options are appropriate for all operations; the drop-down will
change when you change the selected operation, and so will the tool
paths shown in the display.

If you want to hide the source SVG to see
the toolpaths more clearly, you can enable the `View↘Hide SVG`
option.

## Approximation

### Curves
Bezier curves in paths are supported by converting them to a sequence
of straight line segments. The `Minimum Segments` and `Minimum Segment Length`
properties give you some control over this conversion.
Curve conversion happens when something is first selected, so don't expect
to see any effect on existing operations.

### Shrinking/growing polygons (Offsetting)
Offsetting is used when calculating paths for Inside, Outside, Perforate and pockecting operations. You can manipulate these settings to improve the accuracy/look of paths, trading accuracy off against software (and CNC) performance.

## Gcode Generation

In the `Gcode Generation` pane, select the units that your machine
operates in. If your machine supports the `G21` code you can just use
the units you are most comfortable in.

All CNC machines have a coordinate system where X increases to the right,
Y away from the operator, and Z increases upwards. SVG cut shows you where
the machine 0.0 is relative to your work using an axes cursor - green
for Y, and red for X, same as Candle.

You can choose for the machine origin to correspond to the bottom left
of the SVG page, or to the bottom left or centre of the bounding box
around your selected operations. For example, let's say we want to
carve the Sanskrit word "Love". We have drawn it on a 80x60mm page,
using Inkscape.  The top left corner of the bounding box of the
drawing in Inkscape is at (10,15)mm while the bottom right corner is
at (70,45)mm, as shown by the green lettering.

<img src="/images/coords.svg" style="width:50%;height: auto"></img>

When we load up SVGcut and generate Gcode for this drawing with the
`Origin` set to `SVG Page`, then the lower left corner of the SVG page
becomes machine (0,0) and the lower left corner of the bounding box
will be at machine (10,15), as shown by the orange letters.

If we now switch the origin to `Bounding Box`, then the lower left
corner of the bounding box becomes machine (0,0), and the top right is
(60,30), as shown by the magenta letters.

If the origin is set to `Centre` then the centre of the bounding box
will be machine (0,0) while the bottom left corner will be at
(-30,-15).

As well as the "SVG page", "Bounding box", and "Centre", origins, you
can also add an additional offset to the origin. For
example, if you want to move the machine origin several times and
repeat the same cut.

## Previewing the Gcode

### Simulator

At any point you can preview the Gcode using the `View↘Simulation` menu. This
really is a Gcode simulator; it reloads the generated Gcode, and
displays the paths the tool will follow. Previewing is a good idea, as
it can help you pick up on cases where the tool diameter is too great
to cut an acute angle.

### Code preview

You can also use the `View↘Gcode` menu item to open a text view on the Gcode.

## Saving the Gcode

Once you are happy with the Gcode, save it to a file using the `File↘Save Gcode` menu. You can call it what you want, though if you use the
extension `.nc` it will be easier to find in Candle.

# Projects

The `File` menu lets you save and reload projects. You can save in
a file, or in the browser.

Projects can get quite big, and the browser has limited storage space,
so keep the browser for templates and store project files to disc.

## Templates
When you start up the app for the first time, it starts up with a
number of defaults, many of which you will probably change to suit
your own machine. You can save your new defaults for use in other
projects by selecting `Template only` when you save your project. If
you save a template called `defaults` in the browser, it will
automatically be loaded whenever you start up. You might have a number
of different tool configurations; you can save them the same way,
giving them meaningful names.

# Holding Tabs

To use
[holding tabs](https://www.axyz.com/technical-tip-of-the-week-when-to-use-holding-tabs/)
you have to draw paths in your SVG where you want the tabs to be. In
SVGcut, select these paths and use `Create Tabs` on the `Holding Tabs` pane to
specify them as tabs. When the cutter passes over these areas, it will
be limited to cutting to the depth you specify.

# Relationship to `jscut`

SVGcut is a fork of
[Todd Fleming's `jscut`](https://github.com/tbfleming/jscut).
Development of `jscut` stopped some years ago, leaving a number
of pull requests and issues unaddressed. SVGcut has fixes for some of
these, and more.
+ Support for saving and loading projects
+ Open paths (polylines) as well as closed (polygons)
+ Cleaner selection
+ Zoom and pan on paths
+ Easier to work with XY origins
+ Perforate operation
+ Raster pocket operation
+ Drill operation (for PCBs)
+ Per-operation spindle speed control
+ Gcode text preview
+ Extensive newbie documentation

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

Todd Fleming is recognised as author of all his code, even where it has
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

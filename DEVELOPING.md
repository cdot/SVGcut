# SVG
Draw polys and fill them with colour so they can easily be identified in jscut.
It doesn't matter what the page size is, jscut orients itself to the drawn polys.

Don't enable stroke paint! It just complicates the origins. Just use fill.

Inkscape uses an origin at the top left of the figure, with Y increasing downwards. This reflects how SVG works directly, but causes some irritation in jscut. See "Gcode Conversion" for more.

# USAGE

Make sure everything is flipped to mm before doing anything else.

Older version reviewed at https://www.youtube.com/watch?v=dVgf0Hf91vA&t=2927s

## Operations
- Inside follows the tool radius inside the boundary
- Pocket cleans out the pocket
- Outside follows the tool radius outside the boundary
- Engrave follows the boundary with the centre of the tool

You can have multiple operations, each on a different poly. Select a poly,
select "Create Operation". Repeat.

## Tabs
When you select generated paths, you can then select another non-path figure that intersects with it and set a shallower depth. Tabs will compute an intersection with the generated paths and retain that (used to connect inner figures in cut-through)

## Tool
- Angle is the angle of the cutter, used by V Pocket, which I assume is used for undercutting. Leave at 180.
- Pass Depth controls the incremental depth step. 1mm is OK for MDF.
- Step Over when pocketing, controls the fracion of the tool diameter between concentric passes. Leave at 0.4
- Rapid not useful
- Plunge slower is probably better
- Cut slower is better

## Material
- Thickness is a bit irrelevant
- Z Origin keep as the top of the material
- Clearance make sure it's high enough to dodge clips (26mm or more, though avoid end stop)

## Curve to Line Conversion

## Gcode Conversion
Doesn't do anything until Gcode has been generated.

By default the code assumes a coordinate space that has 0,0 at the top
left, as SVG does. The Gcode converter then negates the Y-axis, so a drawing
of a (0, 0) -> (180, 180) rect in Inkscape ends up in Gcode as (0, 0) -> (180, -180). The 3018 uses a coordinate space with 0,0 lower left and Y increasing, so we have to zero the Y axis.

To draw a poly accurately relative to the machine origin, we need
to find the maximum Y coordinate on the poly in the SVG, maxY. The generated Gcode for an Engrave operation will have this at 0,-maxY. If we Zero lower left, this becomes 0,0. At the same time, 0,0 in the SVG becomes 0,maxY on the machine. So if we want the bottom of the poly to be at polyY on the machine, we need to
add polyY to the Yoffset.

Then we have the problem of tool diameter. An outside cut will trace around the outside of the poly. By default, jscut will generate a -ve coordinate for the
tool at the left edge.

### Inside operation
Also Pocket.

#### Default behaviour
- X and Y Offsets are both 0
- Min X is the tool radius
- Max X is +ve the maximum in the SVG
- Min Y is -ve the maximum in the SVG
- Max Y is -ve the tool radius

#### After Zero lower left
- X Offset is -ve the tool radius
- Y Offset is the maximum in the SVG - the tool radius
- Min X, Max X are unchanged
- Min Y is 0
- Max Y is the maximum in the SVG - the tool diameter

To align the edge of the cutter to the X and Y axes we then:
+ *set X Offset = 0*
+ *set Y offset = the calculated Y offset + the cutter radius*

### Outside operation
#### Default behaviour
- X and Y Offsets are both 0
- Min X is -ve the tool radius
- Max X is the maximum in the SVG + the tool radius
- Min Y is -ve the maximum in the SVG + the tool radius
- Max Y is +ve the tool radius

#### After Zero lower left
- X Offset is +ve the tool radius
- Y Offset is the maximum in the SVG + the cutter diameter
- Min X is 0
- Max X is the maximum X in the SVG + the cutter diameter
- Min Y is 0
- Max Y is the maximum Y in the SVG + the cutter diameter

To align the edge of the cutter to the X and Y axes we then:
+ *set X Offset = 0*
+ *set Y offset = calculated Y offset + the tool radius*

### Engrave operation
#### Default behaviour
- X and Y Offsets are both 0
- Min X is 0
- Max X is the maximum X in the SVG
- Min Y is 0
- Max Y is the maximum Y in the SVG

#### After Zero lower left
- X Offset is 0
- Y Offset is the maximum Y in the SVG
- Min X, Max X are unchanged
- Min Y is 0
- Max Y is the maximum Y in the SVG

To align the edge of the cutter to the X and Y axes we then:
+ *set X Offset = tool radius*
+ *set Y offset = calculated Y offset + tool radius*

# Save Gcode
See https://www.linuxcnc.org/docs/html/gcode for Gcode. Not sure what
is supported on the 3018.

# The Code
## Bower
Bower is only used to install Polymer (see npm @polymer/polymer. which
AFAICT is only used for testing.

## Boost
boost and boost-libs required

## Emscripten
Used to compile C++ code to WebAssembly, which can then be called
from Javascript. "Module" is a global JavaScript object provided by
Emscripten with attributes that Emscripten-generated code calls at
various points in its execution.
See https://emscripten.org/docs/api_reference/module.html.

separateTabs
vPocket

/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// Vertex shader for the cut path

uniform float resolution;
// Diameter of the cutter bit
uniform float cutterDia;
uniform vec2 pathXYOffset;
uniform float pathScale;
// Min Z in the entire path
uniform float pathMinZ;
// Top of the material
uniform float pathTopZ;
// Time (in the range 0..1000) the simulation is frozen
uniform float stopAtTime;

/*in*/attribute vec3 pos1;       // Previous position 0, 1, 2
/*in*/attribute vec3 pos2;       // Current position 3, 4, 5
/*in*/attribute float startTime; // 6
/*in*/attribute float endTime;   // 7
/*in*/attribute float command;   // 8
/*in*/attribute vec3 rawPos;     // 9, optional

/*out*/varying vec4 colour;
/*out*/varying vec2 center;
/*out*/varying float radius;
/*out*/varying float enable;

// On each step of the simulation, the cutter makes a hole. This appears
// to be carving out that hole.
void main(void) {
  enable = 1.0;

  vec3 clampedPos2;

  clampedPos2 = pos2;
  if (stopAtTime < startTime)
    enable = 0.0;
  else if (stopAtTime < endTime)
    clampedPos2 = pos1 + (pos2 - pos1) * (stopAtTime - startTime)
      / (endTime - startTime );

  vec3 lower, upper;
  if (pos1.z < pos2.z) {
    lower = vec3((pos1.xy + pathXYOffset) * pathScale, pos1.z);
    upper = vec3((clampedPos2.xy + pathXYOffset) * pathScale,
                 clampedPos2.z);
  } else {
    lower = vec3((clampedPos2.xy + pathXYOffset) * pathScale,
                 clampedPos2.z);
    upper = vec3((pos1.xy + pathXYOffset) * pathScale, pos1.z);
  }

  // command 00-02: lower circle triangle 1
  // command 03-05: lower circle triangle 2
  // command 06-08: upper circle triangle 1
  // command 09-11: upper circle triangle 2
  // command 12-14: connecting line triangle 1
  // command 15-17: connecting line triangle 2
  // command 100: pos1 + rawPos
  // command 101: clampedPos2 + rawPos
  // command 200: discard

  int i = int(command);
  vec3 thisPos;
  if (i < 6)
    thisPos = lower;
  else
    thisPos = upper;

  center = (thisPos.xy * resolution + resolution) / 2.0;
  colour = vec4(1.0, 1.0, 1.0, 1.0); // CC: doesn't seem to have any effect
  float r = cutterDia * pathScale / 2.0;

  if (i < 12) {
    // lower and upper circle triangles 
    radius = r * resolution / 2.0;      
    vec2 offset;
    if (i == 0 || i == 6)
      offset = vec2(-r, -r);
    else if(i == 1 || i == 7)
      offset = vec2(r, r);
    else if(i == 2 || i == 8)
      offset = vec2(-r, r);
    else if(i == 3 || i == 9)
      offset = vec2(-r, -r);
    else if(i == 4 || i == 10)
      offset = vec2(r, -r);
    else if(i == 5 || i == 11)
      offset = vec2(r, r);
    gl_Position = vec4(thisPos.xy + offset, thisPos.z, 1.0);
  } else {
    radius = 0.0;
    vec2 delta = normalize(lower.xy - upper.xy) * r;
    float l = length(delta);
    if (i == 12) // connecting line triangle 1
      gl_Position = vec4(upper.x + delta.y, upper.y - delta.x,
                         upper.z, 1.0);
    else if (i == 13) // connecting line triangle 1
      gl_Position = vec4(lower.x + delta.y, lower.y - delta.x,
                         lower.z, 1.0);
    else if (i == 14) // connecting line triangle 1
      gl_Position = vec4(upper.x - delta.y, upper.y + delta.x,
                         upper.z, 1.0);
    else if (i == 15) // connecting line triangle 2
      gl_Position = vec4(upper.x - delta.y, upper.y + delta.x,
                         upper.z, 1.0);
    else if (i == 16) // connecting line triangle 2
      gl_Position = vec4(lower.x + delta.y, lower.y - delta.x,
                         lower.z, 1.0);
    else if (i == 17) // connecting line triangle 2
      gl_Position = vec4(lower.x - delta.y, lower.y + delta.x,
                         lower.z, 1.0);
    else if (i == 100) // pos1 + rawPos (vBit only)
      gl_Position = vec4((pos1.xy + rawPos.xy + pathXYOffset) * pathScale,
                         pos1.z + rawPos.z, 1.0);
    else if (i == 101) // clampedPos + rawPos (vBit only)
      gl_Position = vec4((clampedPos2.xy + rawPos.xy + pathXYOffset)
                         * pathScale, clampedPos2.z + rawPos.z, 1.0);
    else if (i == 200) { // discard
      gl_Position = vec4(0, 0, 0, 1.0);
      enable = 0.0;
    }
  }

  float bottom = pathMinZ;
  if (bottom == pathTopZ)
    bottom = pathTopZ - 1.0;

  // colour.r = normalized cut depth
  // not clear why the other dimensopns of colour are ignored - only
  // red seems to have any effect
  colour.r = (gl_Position.z - pathTopZ) / (bottom - pathTopZ);

  gl_Position.z = 1.9999 * (gl_Position.z - bottom)
    / (pathTopZ - bottom) - 1.0;
}

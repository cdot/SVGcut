/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// A vertex in the heightmap for the surface of the material being worked

uniform float resolution;
uniform float pathScale;
uniform float pathMinZ;
uniform float pathTopZ;
uniform mat4 rotate;
uniform sampler2D heightMap;

/*in*/attribute vec2 pos0;
/*in*/attribute vec2 pos1;
/*in*/attribute vec2 pos2;
/*in*/attribute vec2 thisPos;
/*in*/attribute float vertex;

/*out*/varying vec4 colour;

vec3 getPos(in vec2 p) {
  return vec3(p * 2.0 / resolution - vec2(1.0, 1.0),
              // Sample the heightMap to get the colour at this pos
              texture2D(heightMap, p / resolution).r);
              // V3texture(heightMap, p / resolution).r);
}

// Draws the height map in the simulation
void main(void) {
  vec3 p0 = getPos(pos0);
  vec3 p1 = getPos(pos1);
  vec3 p2 = getPos(pos2);
  vec3 tp = getPos(thisPos);

  // Colour of the top of the material
  vec4 topColour = vec4(0.82, 0.69, 0.3, 1.0);
  // Colour of the deepest point cut to, linearly interpolate from topColour
  // to get the actual colour
  vec4 botColour = vec4(0.6, 0.6, 0.6, 1.0);
  colour = mix(topColour, botColour, tp.z);

  // Some magic?
  vec4 transitionColour = vec4(0.0, 0.0, 0.0, 1.0);
  float transition = min(0.4, 100.0 * max(abs(p0.z - p1.z), abs(p0.z - p2.z)));
  colour = mix(colour, transitionColour, transition);

  // try to make it look like it does to people with red-green colour blindness
  // for usability testing.
  //colour.rg = vec2((colour.r + colour.g) / 2.0, (colour.r + colour.g) / 2.0);

  vec4 p = vec4(tp.xy, -tp.z * (pathTopZ - pathMinZ) * pathScale, 1.0);

  mat4 offset = mat4(1.0,    0.0,    0.0,    0.0,
                     0.0,    1.0,    0.0,    0.0,
                     0.0,    0.0,    1.0,    0.0,
                     0.0,    0.0,    -3.5,   1.0
                     );

  float left = -.6;
  float right = .6;
  float top = .6;
  float bot = -.6;
  float near = 2.0;
  float far = 5.0;
  mat4 camera = mat4(2.0 *near / (right - left), 0.0, 0.0, 0.0, 
                     0.0, 2.0 * near / (top - bot), 0.0, 0.0,
                     (right + left) / (right - left),
                       (top + bot) / (top - bot),
                       (far + near) / (near - far),
                       -1,
                     0.0, 0.0, 2.0 * far * near / (near - far), 0.0);

  gl_Position = camera * offset * rotate * p;
}

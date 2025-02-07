/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// Fragment shader for the path

// How much precision the GPU uses when calculating floats.
precision mediump float;

/*in*/varying vec4 colour;
/*in*/varying vec2 center;
/*in*/varying float radius;
/*in*/varying float enable;

void main(void) {
  gl_FragColor = colour;
  //V3 layout(location = 0) out vec4 colour;
  if (enable == 0.0
      || radius > 0.0 && distance(gl_FragCoord.xy, center) > radius)
    discard;
}

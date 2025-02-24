/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// Generic vertex shader, used for the cutter

// How much precision the GPU uses when calculating floats.
precision mediump float;

uniform vec3 scale;
uniform vec3 translate;
uniform mat4 rotate;

/*in*/attribute vec3 vPos;

void main(void) {
  mat4 translateScale = mat4(
        scale.x,        0.0,            0.0,                0.0,
        0.0,            scale.y,        0.0,                0.0,
        0.0,            0.0,            scale.z,            0.0,
        translate.x,    translate.y,    translate.z,        1.0);
  float left = -0.6;
  float right = 0.6;
  float top = 0.6;
  float bot = -0.6;
  float near = 2.0;
  float far = 5.0;
  mat4 camera = mat4(
    2.0 * near / (right - left), 0.0, 0.0, 0.0,
    0.0, 2.0 * near / (top - bot), 0.0, 0.0,
    (right + left) / (right - left), (top + bot) / (top - bot),
    (far + near) / (near - far), -1,
    0.0, 0.0, 2.0 * far * near / (near - far), 0.0);

  gl_Position = camera * (rotate * translateScale * vec4(vPos, 1.0)
                          + vec4(0.0, 0.0, -3.5, 0.0));
}

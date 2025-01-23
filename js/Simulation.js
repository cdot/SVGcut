/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global App */

import * as mat4 from "gl-matrix/mat4.js";

const GPU_MEM = 2 * 1024 * 1024;
const RESOLUTION = 1024;
const MESH_STRIDE = 9;
const CYL_STRIDE = 6;
const HALF_CIRCLE_SEGMENTS = 5;

/**
 * Singleton that supports animation of a tool path using WebGL. This
 * module is virtually stand-alone - once the simulation has been
 * started, the `setPath` method is used to load the path to be
 * simulated.
 */
class Simulation {

  /**
   * You can't do anything with it until you call start()
   * @param {string} shaderDir relative directory to load shaders from.
   * @param {HTMLCanvasElement} canvas element to display the simulation in.
   * @param {HTMLElement} timeControl time control input, limited to
   * values between 0 and 1000. This will usually be an
   * `<input type=range>`.
   */
  constructor(shaderDir, canvas, timeControl) {

    /**
     * Canvas being rendered to
     * @member {HTMLCanvasElement}
     * @private
     */
    this.canvas = canvas;

    /**
     * Simlation time control
     * @member {HTMLElement}
     * @private
     */
    this.timeControl = timeControl;

    /**
     * relative directory to load shaders from
     * @member {string}
     * @private
     */
    this.shaderDir = shaderDir;

    /**
     * @member {number}
     * @private
     */
    this.totalTime = 0;

    /**
     * Flag to indicate if the path texture has to be created
     * @member {boolean}
     * @private
     */
    this.needToCreatePathTexture = false;

    /**
     * @member {boolean}
     * @private
     */
    this.needToDrawHeightMap = false;

    /**
     * @member {boolean}
     * @private
     */
    this.isVBit = false;

    /**
     * Height of cutter cylinder
     * @member {number}
     * @private
     */
    this.cutterH = 0;

    /**
     * Cutter diameter
     * @member {number}
     * @private
     */
    this.cutterDia = 0;

    /**
     * @member {number}
     * @private
     */
    this.cutterAngleRad = Math.PI;

    /**
     * @member {number}
     * @private
     */
    this.stopAtTime = 9999999;

    /**
     * @member {number}
     * @private
     */
    this.rotate = mat4.create();

    this.pendingRequest = false;

    /**
     * gl programs
     * @member {object.<string,WebGLProgram>}
     * @private
     */
    this.programs = {
      path: null,
      heightMap: null,
      basic: null
    };

    /**
     * gl shaders, initially mapped to shader type, will become the actual
     * shader during load
     * @member {object.<string,WebGLShader>}
     * @private
     */
    this.shaders = {};

    /**
     * GL buffer for material mesh
     * @member {WebGLBuffer}
     * @private
     */
    this.meshBuffer = undefined;

    /**
     * Number of vertices in mesh buffer
     * @member {number}
     * @private
     */
    this.meshNumVertices = 0;

    /**
     * GL buffer for tool cylinder
     * @member {WebGLBuffer}
     * @private
     */
    this.cylBuffer = undefined;

    /**
     * Number of vertices in cylinder buffer
     * @member {number}
     * @private
     */
    this.cylNumVertices = 0;

    /**
     * GL buffer for tool path
     * @member {WebGLBuffer}
     * @private
     */
    this.pathBuffer = undefined;

    /**
     * Number of vertices in tool path buffer
     * @member {number}
     * @private
     */
    this.pathNumVertices = 0;

    /**
     * @member {Float32Array}
     * @private
     */
    this.pathBufferContent = undefined;

    /**
     * @member {number}
     * @private
     */
    this.pathStride = 9;

    /**
     * @member {number}
     * @private
     */
    this.pathVerticesPerLine = 18;

    /**
     * @member {WebGLFramebuffer}
     * @private
     */
    this.pathFramebuffer = null;

    /**
     * @member {WebGLTexture}
     * @private
     */
    this.pathRgbaTexture = null;

    /**
     * @member {number}
     * @private
     */
    this.pathXOffset = 0;

    /**
     * @member {number}
     * @private
     */
    this.pathYOffset = 0;

    /**
     * @member {number}
     * @private
     */
    this.pathScale = 1;

    /**
     * @member {number}
     * @private
     */
    this.pathMinZ = -1;

    /**
     * Top of the material
     * @member {number}
     * @private
     */
    this.pathTopZ = 0;

    /**
     * @member {number}
     * @private
     */
    this.pathNumPoints = 0;

    /**
     * Rendering context
     * @member {WebGLRenderingContext}
     * @private
     */
    this.gl = canvas.getContext("webgl"); // don't need webgl2 - yet!
  }

  /**
   * @private
   */
  constructMeshBuffer() {
    const numTriangles = RESOLUTION * (RESOLUTION - 1);
    this.meshNumVertices = numTriangles * 3;
    const bufferContent = new Float32Array(this.meshNumVertices * MESH_STRIDE);
    let pos = 0;
    for (let y = 0; y < RESOLUTION - 1; ++y)
      for (let x = 0; x < RESOLUTION; ++x) {
        let left = x - 1;
        if (left < 0)
          left = 0;
        let right = x + 1;
        if (right >= RESOLUTION)
          right = RESOLUTION - 1;
        if (!(x & 1) ^ (y & 1))
          for (let i = 0; i < 3; ++i) {
            bufferContent[pos++] = left;
            bufferContent[pos++] = y + 1;
            bufferContent[pos++] = x;
            bufferContent[pos++] = y;
            bufferContent[pos++] = right;
            bufferContent[pos++] = y + 1;
            if (i === 0) {
              bufferContent[pos++] = left;
              bufferContent[pos++] = y + 1;
            } else if (i === 1) {
              bufferContent[pos++] = x;
              bufferContent[pos++] = y;
            }
            else {
              bufferContent[pos++] = right;
              bufferContent[pos++] = y + 1;
            }
            bufferContent[pos++] = i;
          }
        else
          for (let i = 0; i < 3; ++i) {
            bufferContent[pos++] = left;
            bufferContent[pos++] = y;
            bufferContent[pos++] = right;
            bufferContent[pos++] = y;
            bufferContent[pos++] = x;
            bufferContent[pos++] = y + 1;
            if (i === 0) {
              bufferContent[pos++] = left;
              bufferContent[pos++] = y;
            } else if (i === 1) {
              bufferContent[pos++] = right;
              bufferContent[pos++] = y;
            }
            else {
              bufferContent[pos++] = x;
              bufferContent[pos++] = y + 1;
            }
            bufferContent[pos++] = i;
          }
      }

    //bufferContent = new Float32Array([
    //    1,1,126,1,64,126,    0,
    //    1,1,126,1,64,126,    1,
    //    1,1,126,1,64,126,    2,
    //]);
    //this.meshNumVertices = 3;

    this.meshBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.meshBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER, bufferContent, this.gl.STATIC_DRAW);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  /**
   * @private
   */
  constructCylBuffer() {
    const numDivisions = 40;
    const numTriangles = numDivisions * 4;
    this.cylNumVertices = numTriangles * 3;
    const bufferContent = new Float32Array(this.cylNumVertices * CYL_STRIDE);
    const r = 0.7, g = 0.7, b = 0.0;

    let pos = 0;
    function addVertex(x, y, z) {
      bufferContent[pos++] = x;
      bufferContent[pos++] = y;
      bufferContent[pos++] = z;
      bufferContent[pos++] = r;
      bufferContent[pos++] = g;
      bufferContent[pos++] = b;
    }

    let lastX = .5 * Math.cos(0);
    let lastY = .5 * Math.sin(0);
    for (let i = 0; i < numDivisions; ++i) {
      let j = i + 1;
      if (j === numDivisions)
        j = 0;
      const x = .5 * Math.cos(j * 2 * Math.PI / numDivisions);
      const y = .5 * Math.sin(j * 2 * Math.PI / numDivisions);

      addVertex(lastX, lastY, 0);
      addVertex(x, y, 0);
      addVertex(lastX, lastY, 1);
      addVertex(x, y, 0);
      addVertex(x, y, 1);
      addVertex(lastX, lastY, 1);
      addVertex(0, 0, 0);
      addVertex(x, y, 0);
      addVertex(lastX, lastY, 0);
      addVertex(0, 0, 1);
      addVertex(lastX, lastY, 1);
      addVertex(x, y, 1);

      lastX = x;
      lastY = y;
    }

    this.cylBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.cylBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, bufferContent, this.gl.STATIC_DRAW);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  /**
   * @private
   */
  linkBasicProgram(gl) {
    const program = gl.createProgram();
    gl.attachShader(program, this.shaders.basicVertex);
    gl.attachShader(program, this.shaders.basicFragment);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(
      program, gl.LINK_STATUS))
      throw new Error("Could not initialise basic shaders");

    gl.useProgram(program);
    program.scale = gl.getUniformLocation(program, "scale");
    program.translate = gl.getUniformLocation(program, "translate");
    program.rotate = gl.getUniformLocation(program, "rotate");
    program.vPos = gl.getAttribLocation(program, "vPos");
    program.vColor = gl.getAttribLocation(program, "vColor");
    gl.useProgram(null);

    return program;
  }

  /**
   * @private
   */
  linkRenderHeightMapProgram(gl) {
    const program = gl.createProgram();

    gl.attachShader(program, this.shaders.heightMapVertex);
    gl.attachShader(program, this.shaders.heightMapFragment);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Could not initialise RenderHeightMap shaders");

    gl.useProgram(program);
    program.resolution = gl.getUniformLocation(program, "resolution");
    program.pathScale = gl.getUniformLocation(program, "pathScale");
    program.pathMinZ = gl.getUniformLocation(program, "pathMinZ");
    program.pathTopZ = gl.getUniformLocation(program, "pathTopZ");
    program.rotate = gl.getUniformLocation(program, "rotate");
    program.heightMap = gl.getUniformLocation(program, "heightMap");
    program.pos0 = gl.getAttribLocation(program, "pos0");
    program.pos1 = gl.getAttribLocation(program, "pos1");
    program.pos2 = gl.getAttribLocation(program, "pos2");
    program.thisPos = gl.getAttribLocation(program, "thisPos");
    //program.command = gl.getAttribLocation(program, "command");
    gl.useProgram(null);

    return program;
  }

  /**
   * @throws {Error}
   * @private
   */
  linkRasterizePathProgram(gl) {
    const program = gl.createProgram();
    gl.attachShader(program, this.shaders.pathVertex);
    gl.attachShader(program, this.shaders.pathFragment);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, this.gl.LINK_STATUS))
      throw new Error("Could not initialise RasterizePath shaders");

    gl.useProgram(program);
    program.resolution = gl.getUniformLocation(program, "resolution");
    program.cutterDia = gl.getUniformLocation(program, "cutterDia");
    program.pathXYOffset = gl.getUniformLocation(program, "pathXYOffset");
    program.pathScale = gl.getUniformLocation(program, "pathScale");
    program.pathMinZ = gl.getUniformLocation(program, "pathMinZ");
    program.pathTopZ = gl.getUniformLocation(program, "pathTopZ");
    program.stopAtTime = gl.getUniformLocation(program, "stopAtTime");
    program.pos1 = gl.getAttribLocation(program, "pos1");
    program.pos2 = gl.getAttribLocation(program, "pos2");
    program.rawPos = gl.getAttribLocation(program, "rawPos");
    program.startTime = gl.getAttribLocation(program, "startTime");
    program.endTime = gl.getAttribLocation(program, "endTime");
    program.command = gl.getAttribLocation(program, "command");
    gl.useProgram(null);

    return program;
  }

  /**
   * @private
   */
  requestFrame() {
    if (!this.pendingRequest) {
      requestAnimationFrame(() => this.render());
      this.pendingRequest = true;
    }
  }

  /**
   * @private
   */
  vBit(idx, prev, curr, bufferContent, beginTime, time) {
    const coneHeight = -Math.min(curr.z, prev.z, 0) + .1;
    const coneDia = coneHeight * 2
          * Math.sin(this.cutterAngleRad / 2)
          / Math.cos(this.cutterAngleRad / 2);

    let rotAngle;
    if (curr.x === prev.x && curr.y === prev.y)
      rotAngle = 0;
    else
      rotAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const xyDist = Math.sqrt((curr.x - prev.x) * (curr.x - prev.x)
                             + (curr.y - prev.y) * (curr.y - prev.y));

    function addToBuffer(virtexIndex, command,
                         rawX, rawY, rawZ, rotCos, rotSin, zOffset = 0) {
      const base = idx * this.pathStride *
            this.pathVerticesPerLine + virtexIndex * this.pathStride;
      bufferContent[base + 0] = prev.x;
      bufferContent[base + 1] = prev.y;
      bufferContent[base + 2] = prev.z + zOffset;
      bufferContent[base + 3] = curr.x;
      bufferContent[base + 4] = curr.y;
      bufferContent[base + 5] = curr.z + zOffset;
      bufferContent[base + 6] = beginTime;
      bufferContent[base + 7] = time;
      bufferContent[base + 8] = command;
      bufferContent[base + 9] = rawX * rotCos - rawY * rotSin;
      bufferContent[base + 10] = rawY * rotCos + rawX * rotSin;
      bufferContent[base + 11] = rawZ;
    }

    if (Math.abs(curr.z - prev.z) >= xyDist * Math.PI
        / 2 * Math.cos(this.cutterAngleRad / 2)
        / Math.sin(this.cutterAngleRad / 2)) {

      // plunge or retract
      let index = 0;

      // command 100: pos1 + rawPos
      // command 101: clampedPos2 + rawPos
      const command = prev.z < curr.z ? 100 : 101;
      for (let circleIndex = 0;
           circleIndex < HALF_CIRCLE_SEGMENTS*2; ++circleIndex) {
        const a1 = 2 * Math.PI * circleIndex / HALF_CIRCLE_SEGMENTS/2;
        const a2 = 2 * Math.PI * (circleIndex + 1) / HALF_CIRCLE_SEGMENTS/2;
        addToBuffer(index++, command, coneDia / 2 * Math.cos(a2),
                    coneDia / 2 * Math.sin(a2), coneHeight, 1, 0);
        addToBuffer(index++, command, 0, 0, 0, 1, 0);
        addToBuffer(index++, command, coneDia / 2 * Math.cos(a1),
                    coneDia / 2 * Math.sin(a1), coneHeight, 1, 0);
      }

      //if (index > this.pathVerticesPerLine)
      //    console.debug("oops...");
      while (index < this.pathVerticesPerLine)
        addToBuffer(index++, 200, 0, 0, 0, 1, 0);
    } else {
      //console.debug("cut");
      // cut
      const planeContactAngle = Math.asin(
        (prev.z - curr.z) / xyDist
        * Math.sin(this.cutterAngleRad / 2)
        / Math.cos(this.cutterAngleRad / 2));
      //console.debug("\nxyDist = ", xyDist);
      //console.debug("delta z = " + (z - prev.z));
      //console.debug("planeContactAngle = " + (planeContactAngle * 180 / Math.PI));

      let index = 0;
      //if (true) {
      addToBuffer(index++, 100, 0, -coneDia / 2, coneHeight,
                  Math.cos(rotAngle - planeContactAngle),
                  Math.sin(rotAngle - planeContactAngle));
      addToBuffer(index++, 101, 0, -coneDia / 2, coneHeight,
                  Math.cos(rotAngle - planeContactAngle),
                  Math.sin(rotAngle - planeContactAngle));
      addToBuffer(index++, 100, 0, 0, 0, 1, 0);
      addToBuffer(index++, 100, 0, 0, 0, 1, 0);
      addToBuffer(index++, 101, 0, -coneDia / 2, coneHeight,
                  Math.cos(rotAngle - planeContactAngle),
                  Math.sin(rotAngle - planeContactAngle));
      addToBuffer(index++, 101, 0, 0, 0, 1, 0);
      addToBuffer(index++, 100, 0, 0, 0, 1, 0);
      addToBuffer(index++, 101, 0, 0, 0, 1, 0);
      addToBuffer(index++, 100, 0, coneDia / 2, coneHeight,
                  Math.cos(rotAngle + planeContactAngle),
                  Math.sin(rotAngle + planeContactAngle));
      addToBuffer(index++, 100, 0, coneDia / 2, coneHeight,
                  Math.cos(rotAngle + planeContactAngle),
                  Math.sin(rotAngle + planeContactAngle));
      addToBuffer(index++, 101, 0, 0, 0, 1, 0);
      addToBuffer(index++, 101, 0, coneDia / 2, coneHeight,
                  Math.cos(rotAngle + planeContactAngle),
                  Math.sin(rotAngle + planeContactAngle));
      //}

      const startAngle = rotAngle + Math.PI / 2 - planeContactAngle;
      const endAngle = rotAngle + 3 * Math.PI / 2 + planeContactAngle;
      for (let circleIndex = 0; circleIndex < HALF_CIRCLE_SEGMENTS;
           ++circleIndex) {
        let a1 = startAngle + circleIndex / HALF_CIRCLE_SEGMENTS
            * (endAngle - startAngle);
        let a2 = startAngle + (circleIndex + 1) / HALF_CIRCLE_SEGMENTS
            * (endAngle - startAngle);
        //console.debug(`a1,a2: ${a1 * 180 / Math.PI}, ${a2 * 180 / Math.PI}`);

        addToBuffer(index++, 100, coneDia / 2 * Math.cos(a2),
                    coneDia / 2 * Math.sin(a2), coneHeight, 1, 0);
        addToBuffer(index++, 100, 0, 0, 0, 1, 0);
        addToBuffer(index++, 100, coneDia / 2 * Math.cos(a1),
                    coneDia / 2 * Math.sin(a1), coneHeight, 1, 0);
        addToBuffer(index++, 101, coneDia / 2 * Math.cos(a2 + Math.PI),
                    coneDia / 2 * Math.sin(a2 + Math.PI), coneHeight, 1, 0);
        addToBuffer(index++, 101, 0, 0, 0, 1, 0);
        addToBuffer(index++, 101, coneDia / 2 * Math.cos(a1 + Math.PI),
                    coneDia / 2 * Math.sin(a1 + Math.PI), coneHeight, 1, 0);
      }

      //if (index != this.pathVerticesPerLine)
      //    console.debug("oops...");
      //while (index < this.pathVerticesPerLine)
      //    addToBuffer(index++, 200, 0, 0, 0, 1, 0);
    }
  }

  /**
   * Add a point to the buffer assuming a flat bit
   * @private
   */
  flatBit(idx, prev, curr, bufferContent, beginTime, time) {
    for (let virtex = 0; virtex < this.pathVerticesPerLine; ++virtex) {
      const base = idx * this.pathStride * this.pathVerticesPerLine
          + virtex * this.pathStride;
      bufferContent[base + 0] = prev.x;
      bufferContent[base + 1] = prev.y;
      bufferContent[base + 2] = prev.z;
      bufferContent[base + 3] = curr.x;
      bufferContent[base + 4] = curr.y;
      bufferContent[base + 5] = curr.z;
      bufferContent[base + 6] = beginTime;
      bufferContent[base + 7] = time;
      bufferContent[base + 8] = virtex;
    }
  }

  /**
   * @private
   */
  drawPath() {
    if (!this.pathBuffer) {
      this.pathBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pathBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, GPU_MEM, this.gl.DYNAMIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }

    this.gl.useProgram(this.programs.path);

    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.viewport(0, 0, RESOLUTION, RESOLUTION);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    // Set program variables
    this.gl.uniform1f(this.programs.path.resolution, RESOLUTION);
    this.gl.uniform1f(this.programs.path.cutterDia, this.cutterDia);
    this.gl.uniform2f(this.programs.path.pathXYOffset,
                      this.pathXOffset, this.pathYOffset);
    this.gl.uniform1f(this.programs.path.pathScale, this.pathScale);
    this.gl.uniform1f(this.programs.path.pathMinZ, this.pathMinZ);
    this.gl.uniform1f(this.programs.path.pathTopZ, this.pathTopZ);
    this.gl.uniform1f(this.programs.path.stopAtTime, this.stopAtTime);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pathBuffer);
    this.gl.vertexAttribPointer(
      this.programs.path.pos1, 3, this.gl.FLOAT, false,
      this.pathStride * Float32Array.BYTES_PER_ELEMENT, 0);
    this.gl.vertexAttribPointer(
      this.programs.path.pos2, 3, this.gl.FLOAT, false,
      this.pathStride * Float32Array.BYTES_PER_ELEMENT,
      3 * Float32Array.BYTES_PER_ELEMENT);
    this.gl.vertexAttribPointer(
      this.programs.path.startTime, 1, this.gl.FLOAT, false,
      this.pathStride * Float32Array.BYTES_PER_ELEMENT,
      6 * Float32Array.BYTES_PER_ELEMENT);
    this.gl.vertexAttribPointer(
      this.programs.path.endTime, 1, this.gl.FLOAT, false,
      this.pathStride * Float32Array.BYTES_PER_ELEMENT,
      7 * Float32Array.BYTES_PER_ELEMENT);
    this.gl.vertexAttribPointer(
      this.programs.path.command, 1, this.gl.FLOAT, false,
      this.pathStride * Float32Array.BYTES_PER_ELEMENT,
      8 * Float32Array.BYTES_PER_ELEMENT);
    this.gl.vertexAttribPointer(
      this.programs.path.rawPos, 3, this.gl.FLOAT, false,
      this.pathStride * Float32Array.BYTES_PER_ELEMENT,
      9 * Float32Array.BYTES_PER_ELEMENT);

    this.gl.enableVertexAttribArray(this.programs.path.pos1);
    this.gl.enableVertexAttribArray(this.programs.path.pos2);
    this.gl.enableVertexAttribArray(this.programs.path.startTime);
    this.gl.enableVertexAttribArray(this.programs.path.endTime);
    this.gl.enableVertexAttribArray(this.programs.path.command);
    if (this.isVBit)
      this.gl.enableVertexAttribArray(this.programs.path.rawPos);

    const numTriangles = this.pathNumVertices / 3;
    let lastTriangle = 0;
    const maxTriangles = Math.floor(
      GPU_MEM / this.pathStride / 3 / Float32Array.BYTES_PER_ELEMENT);

    while (lastTriangle < numTriangles) {
      const n = Math.min(numTriangles - lastTriangle, maxTriangles);
      const b = new Float32Array(
        this.pathBufferContent.buffer,
        lastTriangle * this.pathStride * 3 * Float32Array.BYTES_PER_ELEMENT,
        n * this.pathStride * 3);
      this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, b);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, n * 3);
      lastTriangle += n;
    }

    this.gl.disableVertexAttribArray(this.programs.path.pos1);
    this.gl.disableVertexAttribArray(this.programs.path.pos2);
    this.gl.disableVertexAttribArray(this.programs.path.startTime);
    this.gl.disableVertexAttribArray(this.programs.path.endTime);
    this.gl.disableVertexAttribArray(this.programs.path.command);
    this.gl.disableVertexAttribArray(this.programs.path.rawPos);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.useProgram(null);
  }

  /**
   * @private
   */
  createPathFramebuffer() {
    this.pathFramebuffer = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.pathFramebuffer);

    this.pathRgbaTexture = this.gl.createTexture();
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.pathRgbaTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA, RESOLUTION,
      RESOLUTION, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER,
                          this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER,
                          this.gl.NEAREST);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D,
      this.pathRgbaTexture, 0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    const renderbuffer = this.gl.createRenderbuffer();
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, renderbuffer);
    this.gl.renderbufferStorage(
      this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16,
      RESOLUTION, RESOLUTION);
    this.gl.framebufferRenderbuffer(
      this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.RENDERBUFFER,
      renderbuffer);
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  /**
   * @private
   */
  createPathTexture() {
    if (!this.pathFramebuffer)
      this.createPathFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.pathFramebuffer);
    this.drawPath();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.needToCreatePathTexture = false;
    this.needToDrawHeightMap = true;
  }

  /**
   * @private
   */
  drawHeightMap() {
    this.gl.useProgram(this.programs.heightMap);
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.enable(this.gl.DEPTH_TEST);
    const canvasSize = Math.min(this.canvas.width, this.canvas.height);
    this.gl.viewport((this.canvas.width - canvasSize) / 2,
                     (this.canvas.height - canvasSize) / 2,
                     canvasSize, canvasSize);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.pathRgbaTexture);

    this.gl.uniform1f(this.programs.heightMap.resolution, RESOLUTION);
    this.gl.uniform1f(this.programs.heightMap.pathScale, this.pathScale);
    this.gl.uniform1f(this.programs.heightMap.pathMinZ, this.pathMinZ);
    this.gl.uniform1f(this.programs.heightMap.pathTopZ, this.pathTopZ);
    this.gl.uniformMatrix4fv(
      this.programs.heightMap.rotate, false, this.rotate);
    this.gl.uniform1i(this.programs.heightMap.heightMap, 0);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.meshBuffer);
    this.gl.vertexAttribPointer(
      this.programs.heightMap.pos0, 2, this.gl.FLOAT, false,
      MESH_STRIDE * Float32Array.BYTES_PER_ELEMENT, 0);
    this.gl.vertexAttribPointer(
      this.programs.heightMap.pos1, 2, this.gl.FLOAT, false,
      MESH_STRIDE * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT);
    this.gl.vertexAttribPointer(
      this.programs.heightMap.pos2, 2, this.gl.FLOAT, false,
      MESH_STRIDE * Float32Array.BYTES_PER_ELEMENT,
      4 * Float32Array.BYTES_PER_ELEMENT);
    this.gl.vertexAttribPointer(
      this.programs.heightMap.thisPos, 2, this.gl.FLOAT, false,
      MESH_STRIDE * Float32Array.BYTES_PER_ELEMENT,
      6 * Float32Array.BYTES_PER_ELEMENT);
    //this.gl.vertexAttribPointer(this.programs.heightMap.command, 1, this.gl.FLOAT, false, MESH_STRIDE * Float32Array.BYTES_PER_ELEMENT, 8 * Float32Array.BYTES_PER_ELEMENT);

    this.gl.enableVertexAttribArray(this.programs.heightMap.pos0);
    this.gl.enableVertexAttribArray(this.programs.heightMap.pos1);
    this.gl.enableVertexAttribArray(this.programs.heightMap.pos2);
    this.gl.enableVertexAttribArray(this.programs.heightMap.thisPos);
    //this.gl.enableVertexAttribArray(this.programs.heightMap.command);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, this.meshNumVertices);

    this.gl.disableVertexAttribArray(this.programs.heightMap.pos0);
    this.gl.disableVertexAttribArray(this.programs.heightMap.pos1);
    this.gl.disableVertexAttribArray(this.programs.heightMap.pos2);
    this.gl.disableVertexAttribArray(this.programs.heightMap.thisPos);
    //this.gl.disableVertexAttribArray(this.programs.heightMap.command);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.useProgram(null);

    this.needToDrawHeightMap = false;
  }

  /**
   * @private
   */
  drawCutter() {
    function lowerBound(data, offset, stride, begin, end, value) {
      while (begin < end) {
        const i = Math.floor((begin + end) / 2);
        if (data[offset + i * stride] < value)
          begin = i + 1;
        else
          end = i;
      };
      return end;
    }

    function mix(v0, v1, a) {
      return v0 + (v1 - v0) * a;
    }

    if (this.pathNumPoints === 0) {
      console.debug("Simulation.drawCutter: no points");
      return;
    }

    const i = lowerBound(this.pathBufferContent, 7,
                         this.pathStride * this.pathVerticesPerLine,
                         0, this.pathNumPoints, this.stopAtTime);
    let x, y, z;
    if (i < this.pathNumPoints) {
      const offset = i * this.pathStride * this.pathVerticesPerLine;
      const beginTime = this.pathBufferContent[offset + 6];
      const endTime = this.pathBufferContent[offset + 7];
      let ratio;
      if (endTime === beginTime)
        ratio = 0;
      else
        ratio = (this.stopAtTime - beginTime) / (endTime - beginTime);
      x = mix(this.pathBufferContent[offset + 0],
              this.pathBufferContent[offset + 3], ratio);
      y = mix(this.pathBufferContent[offset + 1],
              this.pathBufferContent[offset + 4], ratio);
      z = mix(this.pathBufferContent[offset + 2],
              this.pathBufferContent[offset + 5], ratio);
    }
    else {
      let offset = (i - 1) * this.pathStride * this.pathVerticesPerLine;
      x = this.pathBufferContent[offset + 3];
      y = this.pathBufferContent[offset + 4];
      z = this.pathBufferContent[offset + 5];
    }

    this.gl.useProgram(this.programs.basic);

    this.gl.uniform3f(this.programs.basic.scale,
                      this.cutterDia * this.pathScale,
                      this.cutterDia * this.pathScale,
                      this.cutterH * this.pathScale);
    this.gl.uniform3f(this.programs.basic.translate,
                      (x + this.pathXOffset) * this.pathScale,
                      (y + this.pathYOffset) * this.pathScale,
                      (z - this.pathTopZ) * this.pathScale);
    this.gl.uniformMatrix4fv(this.programs.basic.rotate, false, this.rotate);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.cylBuffer);
    this.gl.vertexAttribPointer(this.programs.basic.vPos, 3,
                                this.gl.FLOAT, false,
                                CYL_STRIDE * Float32Array.BYTES_PER_ELEMENT, 0);
    this.gl.vertexAttribPointer(this.programs.basic.vColor, 3,
                                this.gl.FLOAT, false,
                                CYL_STRIDE * Float32Array.BYTES_PER_ELEMENT,
                                3 * Float32Array.BYTES_PER_ELEMENT);

    this.gl.enableVertexAttribArray(this.programs.basic.vPos);
    this.gl.enableVertexAttribArray(this.programs.basic.vColor);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, this.cylNumVertices);

    this.gl.disableVertexAttribArray(this.programs.basic.vPos);
    this.gl.disableVertexAttribArray(this.programs.basic.vColor);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.useProgram(null);
  }

  /**
   * @private
   */
  render() {
    this.pendingRequest = true;

    if (this.needToCreatePathTexture)
      this.createPathTexture();

    if (this.needToDrawHeightMap) {
      this.drawHeightMap();
      this.drawCutter();
    }

    this.pendingRequest = false;

    //this.needToCreatePathTexture = true;
    //this.needToDrawHeightMap = true;
    //this.stopAtTime += .2;
    //this.requestFrame();
  }

  /**
   * Set the simulation stop time
   * @param {number} t the new stop time
   * @private
   */
  setStopAtTime(t) {
    this.stopAtTime = t;
    // Map the time to a tool position
    this.needToCreatePathTexture = true;
    this.requestFrame();
  }

  /**
   * @private
   */
  setRotate(rot) {
    this.rotate = rot;
    this.needToDrawHeightMap = true;
    this.requestFrame();
  }

  /**
   * Return a promise to load the given WebGL shader from file
   * @param {string} name shader to load
   * @param type gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
   * @return {Promise}
   * @private
   */
  loadShader(name, type) {
    const filename = `${this.shaderDir}/${name}.glsl`;
    const gl = this.gl;
    return fetch(filename)
    .then(response => response.text())
    .then(source => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      const mess = gl.getShaderInfoLog(shader);
      if (mess.length > 0)
        throw new Error(`Shader ${filename} compile failed ${mess}`);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        return shader;
      throw new Error(`Shader ${filename} didn't compile`);
    });
  }

  /**
   * We only add event listeners at the end of start(), when all
   * the shaders have been loaded.
   * @private
   */
  addEventListeners() {
    let mouseDown = false;
    let lastX = 0;
    let lastY = 0;
    const origRotate = mat4.create();

    this.canvas.addEventListener("resize", () => {
      this.needToDrawHeightMap = true;
      this.requestFrame();
    });

    this.timeControl.addEventListener("input", e => {
      const stopAt = e.target.value / 1000 * this.totalTime;
      this.setStopAtTime(stopAt);
    });

    this.canvas.addEventListener("mousedown", e => {
      e.preventDefault();
      mouseDown = true;
      lastX = e.pageX;
      lastY = e.pageY;
      mat4.copy(origRotate, this.rotate);
    });

    document.addEventListener("mousemove", e => {
      if (!mouseDown)
        return;
      const m = mat4.create();
      mat4.rotate(m, m, Math.sqrt(
        (e.pageX - lastX) * (e.pageX - lastX)
        + (e.pageY - lastY) * (e.pageY - lastY)) / 100,
                  [e.pageY - lastY, e.pageX - lastX, 0]);
      mat4.multiply(m, m, origRotate);
      this.setRotate(m);
    });

    document.addEventListener("mouseup", () => {
      mouseDown = false;
    });
  }

  /**
   * Promise to initialise the GL context and load all required shaders.
   * GL shaders are defined in external files with a `.shader.txt`
   * extension that are loaded dynamically.
   * @return {Promise} promise that resolves to undefined
   * @throw {Error} if something goes horribly wrong
   */
  start() {

    const gl = this.gl;

    // Map from shader name to gl type
    const shaders = {
      pathVertex: gl.VERTEX_SHADER,
      pathFragment: gl.FRAGMENT_SHADER,
      heightMapVertex: gl.VERTEX_SHADER,
      heightMapFragment: gl.FRAGMENT_SHADER,
      basicVertex: gl.VERTEX_SHADER,
      basicFragment: gl.FRAGMENT_SHADER
    };

    this.constructMeshBuffer();
    this.constructCylBuffer();

    return Promise.all(
      Object.keys(shaders)
      .map(name =>
        this.loadShader(name, shaders[name])
        .then(shader => this.shaders[name] = shader)))
    .then(() => {
      this.programs.path = this.linkRasterizePathProgram(gl);
      this.programs.heightMap = this.linkRenderHeightMapProgram(gl);
      this.programs.basic = this.linkBasicProgram(gl);

      this.setPath([], 0, 0, 180, 0);

      this.addEventListeners();
    });
  }

  /**
   * Set the path that is being simulated. All parameters use
   * gcode units.
   * @param {object[]} path array of path points, each an object { x, y, z, f}
   * @param {number} topZ top of the material
   * @param {number} cutterDiameter
   * @param {number} cutterAngle angle of V-cutter head, in degrees.
   * Flat heads use 180 (the default).
   * @param {number} cutterHeight height of cutter cylinder, default 1
   */
  setPath(path, topZ,
          cutterDiameter, cutterAngle = 180, cutterHeight = 1) {

    this.pathTopZ = topZ;
    this.cutterDia = cutterDiameter;
    if (cutterAngle <= 0 || cutterAngle > 180)
      cutterAngle = 180;
    this.cutterAngleRad = cutterAngle * Math.PI / 180;
    this.isVBit = cutterAngle < 180;
    this.cutterH = cutterHeight;
    this.needToCreatePathTexture = true;
    this.requestFrame();
    this.pathNumPoints = path.length;

    if (this.isVBit) {
      this.pathStride = 12;
      this.pathVerticesPerLine = 12 + HALF_CIRCLE_SEGMENTS * 6;
    } else {
      this.pathStride = 9;
      this.pathVerticesPerLine = 18;
    }

    this.pathNumVertices = this.pathNumPoints * this.pathVerticesPerLine;
    const bufferContent = new Float32Array(
      this.pathNumPoints * this.pathStride * this.pathVerticesPerLine);
    this.pathBufferContent = bufferContent;

    const startPoint = path[0];
    const min = {
      x: Number.POSITIVE_INFINITY,
      y: Number.POSITIVE_INFINITY,
      z: Number.POSITIVE_INFINITY };
    const max =  {
      x: Number.NEGATIVE_INFINITY,
      y: Number.NEGATIVE_INFINITY,
      z: Number.NEGATIVE_INFINITY };

    let time = 0;
    let prev = startPoint, idx = -1;
    for (const curr of path) {
      idx++;
      const dist = Math.sqrt((curr.x - prev.x) * (curr.x - prev.x)
                             + (curr.y - prev.y) * (curr.y - prev.y)
                             + (curr.z - prev.z) * (curr.z - prev.z));
      const beginTime = time;
      time = time + dist / curr.f * 60;

      min.x = Math.min(min.x, curr.x);
      min.y = Math.min(min.y, curr.y);
      min.z = Math.min(min.z, curr.z);

      max.x = Math.max(max.x, curr.x);
      max.y = Math.max(max.y, curr.y);
      max.z = Math.max(max.z, curr.z);

      if (this.isVBit)
        this.vBit(idx, prev, curr, bufferContent, beginTime, time);
      else
        this.flatBit(idx, prev, curr, bufferContent, beginTime, time);

      prev = curr;
    }
    this.totalTime = time;

    this.pathXOffset = -(min.x + max.x) / 2;
    this.pathYOffset = -(min.y + max.y) / 2;
    const size = Math.max(max.x - min.x + 4 * this.cutterDia,
                          max.y - min.y + 4 * this.cutterDia);
    this.pathScale = 2 / size;
    this.pathMinZ = min.z;

    this.setStopAtTime(this.totalTime);
    this.requestFrame();
  }
}

export { Simulation }

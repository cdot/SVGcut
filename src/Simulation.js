/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

import * as mat4 from "gl-matrix/mat4.js";

const GPU_MEM = 2 * 1024 * 1024;
const RESOLUTION = 1024;
const MESH_STRIDE = 9;
const CYL_STRIDE = 3;// 6 with colour;
const HALF_CIRCLE_SEGMENTS = 5;

/**
 * Singleton that supports animation of a tool path using WebGL. This
 * module is virtually stand-alone - once the simulation has been
 * started, the `setPath` method is used to load the path to be
 * simulated.
 */
export class Simulation {

  /**
   * Canvas being rendered to.
   * @member {HTMLCanvasElement}
   */
  #canvas;

  /**
   * Simulation time control.
   * @member {HTMLElement}
   */
  #timeControl;

  /**
   * Simulation time report.
   * @member {function}
   */
  #stopWatch;

  /**
   * Relative URI to load shaders from.
   * @member {string}
   */
  #shaderURI;

  /**
   * @member {number}
   */
  #totalTime = 0;

  /**
   * Flag to indicate if the path texture has to be created.
   * @member {boolean}
   */
  #needToCreatePathTexture = false;

  /**
   * Flag set if height map is required to be drawn.
   * @member {boolean}
   */
  #needToDrawHeightMap = false;

  /**
     * True if the cutter is a v-bit.
   * @member {boolean}
   */
  #isVBit = false;

  /**
   * Height of cutter cylinder.
   * @member {number}
   */
  #cutterHeight = 0;

  /**
   * Cutter diameter.
   * @member {number}
   */
  #cutterDiameter;

  /**
   * Tool (v bit) head angle, in radians
   * @member {number}
   */
  #cutterAngle = Math.PI;

  /**
   * Where the user has asked to stop
   * @member {object} {t,x,y,z,s}
   */
  #stopAt = { t: 0, x: 0, y: 0, z: 0, s: 0 };

  /**
   * Where to stop the simulation (snapshot time)
   * @member {number}
   */
  #stopAtTime = 0;

  /**
   * gl shaders, initially mapped to shader type, will become the actual
   * shader during load
   * @member {object.<string,WebGLShader>}
   */
  #shaders = {};

  /**
   * GL buffer for material mesh
   * @member {WebGLBuffer}
   */
  #meshBuffer;

  /**
   * Number of vertices in mesh buffer
   * @member {number}
   */
  #meshNumVertices = 0;

  /**
   * GL buffer for tool cylinder
   * @member {WebGLBuffer}
   */
  #cylBuffer;

  /**
   * Number of vertices in cylinder buffer
   * @member {number}
   */
  #cylNumVertices = 0;

  /**
   * GL buffer for tool path
   * @member {WebGLBuffer}
   */
  #pathBuffer = undefined;

  /**
   * Number of vertices in tool path buffer
   * @member {number}
   */
  #pathNumVertices = 0;

  /**
   * @member {Float32Array}
   */
  #pathBufferContent;

  /**
   * @member {number}
   */
  #pathStride = 9;

  /**
   * @member {number}
   */
  #pathVerticesPerLine = 18;

  /**
   * @member {WebGLFramebuffer}
   */
  #pathFramebuffer;

  /**
   * @member {WebGLTexture}
   */
  #pathRgbaTexture;

  /**
   * @member {number}
   */
  #pathXOffset = 0;

  /**
   * @member {number}
   */
  #pathYOffset = 0;

  /**
   * @member {number}
   */
  #pathScale = 1;

  /**
   * @member {number}
   */
  #pathMinZ = -1;

  /**
   * Top of the material
   * @member {number}
   */
  #pathTopZ = 0;

  /**
   * @member {number}
   */
  #pathNumPoints = 0;

  /**
   * Record of time and position. When a path is added to the simulation,
   * an entry is added here that records time, x, y, and z coordinates
   * so they can be seen during replay.
   * @member {object[]} array of {t, x, y, z, f, s}
   */
  #timeSteps = [];

  /**
   * WebGL rendering context.
   * @member {WebGLRenderingContext}
   */
  #gl;

  /**
   * Flag set true when the shaders and programs have been loaded
   */
  #ready = false;

  /**
   * @member {number}
   */
  #rotate = mat4.create();

  /**
   * Is a request pending?
   */
  #pendingRequest = false;

  /**
   * gl programs
   * @member {object.<string,WebGLProgram>}
   */
   #programs = {
     path: null,
     heightMap: null,
     basic: null
   };

  /**
   * Map from shader name to gl type
   */
  #shaderTypes;

  /**
   * You can't do anything with it until you call start()
   * @param {string} shaderURI URI to load shaders from.
   * @param {HTMLCanvasElement} canvas element to display the simulation in.
   * @param {HTMLElement} timeControl time control input, limited to
   * values between 0 and 1000. This will usually be an
   * `<input type=range>`.
   * @param {function} stopWatch callback invoked when the simulation
   * time changes. Passed the new simulation time and the x, y, z
   * location of the tool at that time.
   */
  constructor(shaderURI, canvas, timeControl, stopWatch) {

    this.#canvas = canvas;
    this.#timeControl = timeControl;
    this.#stopWatch = stopWatch;
    this.#shaderURI = shaderURI;

    const gl = canvas.getContext("webgl");
    this.#gl = gl;

    this.#shaderTypes = {
      pathVertex: gl.VERTEX_SHADER,
      pathFragment: gl.FRAGMENT_SHADER,
      heightMapVertex: gl.VERTEX_SHADER,
      heightMapFragment: gl.FRAGMENT_SHADER,
      basicVertex: gl.VERTEX_SHADER,
      basicFragment: gl.FRAGMENT_SHADER
    };

    this.#constructMaterialBuffer();
    this.#constructCutterBuffer();
  }

  /**
   * Promise to initialise the GL context and load all required shaders.
   * GL shaders are defined in external files with a `.shader.txt`
   * extension that are loaded dynamically.
   * @return {Promise} promise that resolves to undefined when the
   * simulation is ready to accept new input.
   * @throw {Error} if something goes horribly wrong
   */
  start() {
    return Promise.all(
      Object.keys(this.#shaderTypes)
      .map(name =>
        this.#loadShader(name, this.#shaderTypes[name])
        .then(shader => this.#shaders[name] = shader)))
    .then(() => {
      this.#programs.path = this.#linkRasterizePathProgram(this.#gl);
      this.#programs.heightMap = this.#linkRenderHeightMapProgram(this.#gl);
      this.#programs.basic = this.#linkBasicProgram(this.#gl);

      this.setPath([], 0, 0, Math.PI / 2, 0);

      this.#addEventListeners();

      this.#ready = true;
    });
  }

  /**
   * Resize the simulation canvas.
   * @param {number} w width
   * @param {number} h height
   */
  resizeCanvas(w, h) {
    this.#canvas.setAttribute("width", w);
    this.#canvas.setAttribute("height", h);
    if (this.#ready) {
      this.#needToDrawHeightMap = true;
      this.#requestFrame();
    }
  }

  /**
   * Construct the vertex buffer for the material.
   */
  #constructMaterialBuffer() {
    const numTriangles = RESOLUTION * (RESOLUTION - 1);
    this.#meshNumVertices = numTriangles * 3;
    const buff = new Float32Array(this.#meshNumVertices * MESH_STRIDE);
    let pos = 0;
    function addVertex(x, y) {
      buff[pos++] = x;
      buff[pos++] = y;
    }
    for (let y = 0; y < RESOLUTION - 1; y++) {
      for (let x = 0; x < RESOLUTION; x++) {
        let left = x - 1;
         if (left < 0)
          left = 0;
        let right = x + 1;
        if (right >= RESOLUTION)
          right = RESOLUTION - 1;
        if (!(x & 1) ^ (y & 1))
          for (let i = 0; i < 3; i++) {
            addVertex(left, y + 1);
            addVertex(x, y);
            addVertex(right, y + 1);
            if (i === 0)
              addVertex(left, y + 1);
            else if (i === 1)
              addVertex(x, y);
            else
              addVertex(right, y + 1);
            buff[pos++] = i;
          }
        else
          for (let i = 0; i < 3; i++) {
            addVertex(left, y);
            addVertex(right, y);
            addVertex(x, y + 1);
            if (i === 0)
              addVertex(left, y);
            else if (i === 1)
              addVertex(right, y);
            else
              addVertex(x, y + 1);
            buff[pos++] = i;
          }
      }
    }

    const gl = this.#gl;
    this.#meshBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#meshBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER, buff, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /**
   * Allocate cutter shader mesh buffer
   */
  #constructCutterBuffer() {
    const numDivisions = 40;
    const numTriangles = numDivisions * 4;
    this.#cylNumVertices = numTriangles * 3;
    const buff = new Float32Array(this.#cylNumVertices * CYL_STRIDE);

    let pos = 0;
    function addVertex(x, y, z) {
      buff[pos++] = x;
      buff[pos++] = y;
      buff[pos++] = z;
    }

    let lastX = Math.cos(0) / 2;
    let lastY = Math.sin(0) / 2;
    for (let i = 0; i < numDivisions; ++i) {
      let j = i + 1;
      if (j === numDivisions)
        j = 0;
      const x = Math.cos(j * 2 * Math.PI / numDivisions) / 2;
      const y = Math.sin(j * 2 * Math.PI / numDivisions) / 2;

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

      lastX = x; lastY = y;
    }

    const gl = this.#gl;
    this.#cylBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#cylBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, buff, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  #linkBasicProgram(gl) {
    const program = gl.createProgram();
    gl.attachShader(program, this.#shaders.basicVertex);
    gl.attachShader(program, this.#shaders.basicFragment);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(
      program, gl.LINK_STATUS))
      throw new Error("Could not initialise basic shaders");

    gl.useProgram(program);

    // Link to shader variables
    program.vPos = gl.getAttribLocation(program, "vPos");
    program.scale = gl.getUniformLocation(program, "scale");
    program.translate = gl.getUniformLocation(program, "translate");
    program.rotate = gl.getUniformLocation(program, "rotate");
    program.colour = gl.getUniformLocation(program, "colour");

    gl.useProgram(null);

    return program;
  }

  #linkRenderHeightMapProgram(gl) {
    const program = gl.createProgram();

    gl.attachShader(program, this.#shaders.heightMapVertex);
    gl.attachShader(program, this.#shaders.heightMapFragment);
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

    gl.useProgram(null);

    return program;
  }

  /**
   * @throws {Error}
   */
  #linkRasterizePathProgram(gl) {
    const program = gl.createProgram();
    gl.attachShader(program, this.#shaders.pathVertex);
    gl.attachShader(program, this.#shaders.pathFragment);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, this.#gl.LINK_STATUS))
      throw new Error("Could not initialise RasterizePath shaders");

    gl.useProgram(program);
    program.resolution = gl.getUniformLocation(program, "resolution");
    program.cutterDiameter = gl.getUniformLocation(program, "cutterDiameter");
    program.pathXYOffset = gl.getUniformLocation(program, "pathXYOffset");
    program.pathScale = gl.getUniformLocation(program, "pathScale");
    program.pathMinZ = gl.getUniformLocation(program, "pathMinZ");
    program.pathTopZ = gl.getUniformLocation(program, "pathTopZ");
    program.stopAtTime = gl.getUniformLocation(program, "stopAtTime");
    program.pos1 = gl.getAttribLocation(program, "pos1");
    program.pos2 = gl.getAttribLocation(program, "pos2");
    program.startTime = gl.getAttribLocation(program, "startTime");
    program.endTime = gl.getAttribLocation(program, "endTime");
    program.command = gl.getAttribLocation(program, "command");
    program.rawPos = gl.getAttribLocation(program, "rawPos");
    gl.useProgram(null);

    return program;
  }

  #requestFrame() {
    if (!this.#pendingRequest) {
      requestAnimationFrame(() => this.#render());
      this.#pendingRequest = true;
    }
  }

  #vBit(idx, prev, curr, buff, beginTime, time) {
    const coneHeight = -Math.min(curr.z, prev.z, 0) + 0.1;
    const coneDia = coneHeight * 2
          * Math.sin(this.#cutterAngle) / Math.cos(this.#cutterAngle);
    const coneDia_2 = coneDia / 2;
    const stride = this.#pathStride;
    const pvpl = this.#pathVerticesPerLine;

    let rotAngle;
    if (curr.x === prev.x && curr.y === prev.y)
      rotAngle = 0;
    else
      rotAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const xyDist = Math.sqrt((curr.x - prev.x) * (curr.x - prev.x)
                             + (curr.y - prev.y) * (curr.y - prev.y));

    function addToBuffer(virtexIndex, command,
                         rawX, rawY, rawZ, rotCos, rotSin, zOffset = 0) {
      const base = stride * (idx * pvpl + virtexIndex);
      buff[base + 0] = prev.x;
      buff[base + 1] = prev.y;
      buff[base + 2] = prev.z + zOffset;
      buff[base + 3] = curr.x;
      buff[base + 4] = curr.y;
      buff[base + 5] = curr.z + zOffset;
      buff[base + 6] = beginTime;
      buff[base + 7] = time;
      buff[base + 8] = command;
      buff[base + 9] = rawX * rotCos - rawY * rotSin;
      buff[base + 10] = rawY * rotCos + rawX * rotSin;
      buff[base + 11] = rawZ;
    }

    if (Math.abs(curr.z - prev.z) >= xyDist * Math.PI
        / 2 * Math.cos(this.#cutterAngle)
        / Math.sin(this.#cutterAngle)) {

      // plunge or retract
      let index = 0;

      // command 100: pos1 + rawPos
      // command 101: clampedPos2 + rawPos
      const command = prev.z < curr.z ? 100 : 101;
      for (let circleIndex = 0;
           circleIndex < HALF_CIRCLE_SEGMENTS*2; ++circleIndex) {
        const a1 = 2 * Math.PI * circleIndex / HALF_CIRCLE_SEGMENTS/2;
        const a2 = 2 * Math.PI * (circleIndex + 1) / HALF_CIRCLE_SEGMENTS/2;
        addToBuffer(index++, command, coneDia_2 * Math.cos(a2),
                    coneDia_2 * Math.sin(a2), coneHeight, 1, 0);
        addToBuffer(index++, command, 0, 0, 0, 1, 0);
        addToBuffer(index++, command, coneDia_2 * Math.cos(a1),
                    coneDia_2 * Math.sin(a1), coneHeight, 1, 0);
      }

      //if (index > this.#pathVerticesPerLine)
      //    console.debug("oops...");
      while (index < this.#pathVerticesPerLine)
        addToBuffer(index++, 200, 0, 0, 0, 1, 0);
    } else {
      //console.debug("cut");
      // cut
      const planeContactAngle = Math.asin(
        (prev.z - curr.z) / xyDist
        * Math.sin(this.#cutterAngle)
        / Math.cos(this.#cutterAngle));
      //console.debug("\nxyDist = ", xyDist);
      //console.debug("delta z = " + (z - prev.z));
      //console.debug("planeContactAngle = " + (planeContactAngle * 180 / Math.PI));

      let index = 0;
      //if (true) {
      addToBuffer(index++, 100, 0, -coneDia_2, coneHeight,
                  Math.cos(rotAngle - planeContactAngle),
                  Math.sin(rotAngle - planeContactAngle));
      addToBuffer(index++, 101, 0, -coneDia_2, coneHeight,
                  Math.cos(rotAngle - planeContactAngle),
                  Math.sin(rotAngle - planeContactAngle));
      addToBuffer(index++, 100, 0, 0, 0, 1, 0);
      addToBuffer(index++, 100, 0, 0, 0, 1, 0);
      addToBuffer(index++, 101, 0, -coneDia_2, coneHeight,
                  Math.cos(rotAngle - planeContactAngle),
                  Math.sin(rotAngle - planeContactAngle));
      addToBuffer(index++, 101, 0, 0, 0, 1, 0);
      addToBuffer(index++, 100, 0, 0, 0, 1, 0);
      addToBuffer(index++, 101, 0, 0, 0, 1, 0);
      addToBuffer(index++, 100, 0, coneDia_2, coneHeight,
                  Math.cos(rotAngle + planeContactAngle),
                  Math.sin(rotAngle + planeContactAngle));
      addToBuffer(index++, 100, 0, coneDia_2, coneHeight,
                  Math.cos(rotAngle + planeContactAngle),
                  Math.sin(rotAngle + planeContactAngle));
      addToBuffer(index++, 101, 0, 0, 0, 1, 0);
      addToBuffer(index++, 101, 0, coneDia_2, coneHeight,
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

        addToBuffer(index++, 100, coneDia_2 * Math.cos(a2),
                    coneDia_2 * Math.sin(a2), coneHeight, 1, 0);
        addToBuffer(index++, 100, 0, 0, 0, 1, 0);
        addToBuffer(index++, 100, coneDia_2 * Math.cos(a1),
                    coneDia_2 * Math.sin(a1), coneHeight, 1, 0);
        addToBuffer(index++, 101, coneDia_2 * Math.cos(a2 + Math.PI),
                    coneDia_2 * Math.sin(a2 + Math.PI), coneHeight, 1, 0);
        addToBuffer(index++, 101, 0, 0, 0, 1, 0);
        addToBuffer(index++, 101, coneDia_2 * Math.cos(a1 + Math.PI),
                    coneDia_2 * Math.sin(a1 + Math.PI), coneHeight, 1, 0);
      }

      //if (index != this.#pathVerticesPerLine)
      //    console.debug("oops...");
      //while (index < this.#pathVerticesPerLine)
      //    addToBuffer(index++, 200, 0, 0, 0, 1, 0);
    }
  }

  /**
   * Add a point to the buffer assuming a flat bit
   */
  #flatBit(idx, prev, curr, buff, beginTime, time) {
    for (let virtex = 0; virtex < this.#pathVerticesPerLine; ++virtex) {
      const base = idx * this.#pathStride * this.#pathVerticesPerLine
          + virtex * this.#pathStride;
      buff[base + 0] = prev.x;
      buff[base + 1] = prev.y;
      buff[base + 2] = prev.z;
      buff[base + 3] = curr.x;
      buff[base + 4] = curr.y;
      buff[base + 5] = curr.z;
      buff[base + 6] = beginTime;
      buff[base + 7] = time;
      buff[base + 8] = virtex;
    }
  }

  #drawPath() {
    if (!this.#pathBuffer) {
      this.#pathBuffer = this.#gl.createBuffer();
      this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, this.#pathBuffer);
      this.#gl.bufferData(this.#gl.ARRAY_BUFFER, GPU_MEM, this.#gl.DYNAMIC_DRAW);
      this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, null);
    }

    this.#gl.useProgram(this.#programs.path);

    this.#gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.#gl.enable(this.#gl.DEPTH_TEST);
    this.#gl.viewport(0, 0, RESOLUTION, RESOLUTION);
    this.#gl.clear(this.#gl.COLOR_BUFFER_BIT | this.#gl.DEPTH_BUFFER_BIT);

    // Set program variables
    this.#gl.uniform1f(this.#programs.path.resolution, RESOLUTION);
    this.#gl.uniform1f(this.#programs.path.cutterDiameter, this.#cutterDiameter);
    this.#gl.uniform2f(this.#programs.path.pathXYOffset,
                      this.#pathXOffset, this.#pathYOffset);
    this.#gl.uniform1f(this.#programs.path.pathScale, this.#pathScale);
    this.#gl.uniform1f(this.#programs.path.pathMinZ, this.#pathMinZ);
    this.#gl.uniform1f(this.#programs.path.pathTopZ, this.#pathTopZ);
    this.#gl.uniform1f(this.#programs.path.stopAtTime, this.#stopAt.t);

    this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, this.#pathBuffer);
    this.#gl.vertexAttribPointer(
      this.#programs.path.pos1, 3, this.#gl.FLOAT, false,
      this.#pathStride * Float32Array.BYTES_PER_ELEMENT, 0);
    this.#gl.vertexAttribPointer(
      this.#programs.path.pos2, 3, this.#gl.FLOAT, false,
      this.#pathStride * Float32Array.BYTES_PER_ELEMENT,
      3 * Float32Array.BYTES_PER_ELEMENT);
    this.#gl.vertexAttribPointer(
      this.#programs.path.startTime, 1, this.#gl.FLOAT, false,
      this.#pathStride * Float32Array.BYTES_PER_ELEMENT,
      6 * Float32Array.BYTES_PER_ELEMENT);
    this.#gl.vertexAttribPointer(
      this.#programs.path.endTime, 1, this.#gl.FLOAT, false,
      this.#pathStride * Float32Array.BYTES_PER_ELEMENT,
      7 * Float32Array.BYTES_PER_ELEMENT);
    this.#gl.vertexAttribPointer(
      this.#programs.path.command, 1, this.#gl.FLOAT, false,
      this.#pathStride * Float32Array.BYTES_PER_ELEMENT,
      8 * Float32Array.BYTES_PER_ELEMENT);
    this.#gl.vertexAttribPointer(
      this.#programs.path.rawPos, 3, this.#gl.FLOAT, false,
      this.#pathStride * Float32Array.BYTES_PER_ELEMENT,
      9 * Float32Array.BYTES_PER_ELEMENT);

    this.#gl.enableVertexAttribArray(this.#programs.path.pos1);
    this.#gl.enableVertexAttribArray(this.#programs.path.pos2);
    this.#gl.enableVertexAttribArray(this.#programs.path.startTime);
    this.#gl.enableVertexAttribArray(this.#programs.path.endTime);
    this.#gl.enableVertexAttribArray(this.#programs.path.command);
    if (this.#isVBit)
      this.#gl.enableVertexAttribArray(this.#programs.path.rawPos);

    const numTriangles = this.#pathNumVertices / 3;
    let lastTriangle = 0;
    const maxTriangles = Math.floor(
      GPU_MEM / this.#pathStride / 3 / Float32Array.BYTES_PER_ELEMENT);

    while (lastTriangle < numTriangles) {
      const n = Math.min(numTriangles - lastTriangle, maxTriangles);
      const b = new Float32Array(
        this.#pathBufferContent.buffer,
        lastTriangle * this.#pathStride * 3 * Float32Array.BYTES_PER_ELEMENT,
        n * this.#pathStride * 3);
      this.#gl.bufferSubData(this.#gl.ARRAY_BUFFER, 0, b);
      this.#gl.drawArrays(this.#gl.TRIANGLES, 0, n * 3);
      lastTriangle += n;
    }

    this.#gl.disableVertexAttribArray(this.#programs.path.pos1);
    this.#gl.disableVertexAttribArray(this.#programs.path.pos2);
    this.#gl.disableVertexAttribArray(this.#programs.path.startTime);
    this.#gl.disableVertexAttribArray(this.#programs.path.endTime);
    this.#gl.disableVertexAttribArray(this.#programs.path.command);
    this.#gl.disableVertexAttribArray(this.#programs.path.rawPos);

    this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, null);
    this.#gl.useProgram(null);
  }

  #createPathFramebuffer() {
    this.#pathFramebuffer = this.#gl.createFramebuffer();
    this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, this.#pathFramebuffer);

    this.#pathRgbaTexture = this.#gl.createTexture();
    this.#gl.activeTexture(this.#gl.TEXTURE0);
    this.#gl.bindTexture(this.#gl.TEXTURE_2D, this.#pathRgbaTexture);
    this.#gl.texImage2D(
      this.#gl.TEXTURE_2D, 0, this.#gl.RGBA, RESOLUTION,
      RESOLUTION, 0, this.#gl.RGBA, this.#gl.UNSIGNED_BYTE, null);
    this.#gl.texParameteri(this.#gl.TEXTURE_2D, this.#gl.TEXTURE_MAG_FILTER,
                          this.#gl.NEAREST);
    this.#gl.texParameteri(this.#gl.TEXTURE_2D, this.#gl.TEXTURE_MIN_FILTER,
                          this.#gl.NEAREST);
    this.#gl.framebufferTexture2D(
      this.#gl.FRAMEBUFFER, this.#gl.COLOR_ATTACHMENT0, this.#gl.TEXTURE_2D,
      this.#pathRgbaTexture, 0);
    this.#gl.bindTexture(this.#gl.TEXTURE_2D, null);

    const renderbuffer = this.#gl.createRenderbuffer();
    this.#gl.bindRenderbuffer(this.#gl.RENDERBUFFER, renderbuffer);
    this.#gl.renderbufferStorage(
      this.#gl.RENDERBUFFER, this.#gl.DEPTH_COMPONENT16,
      RESOLUTION, RESOLUTION);
    this.#gl.framebufferRenderbuffer(
      this.#gl.FRAMEBUFFER, this.#gl.DEPTH_ATTACHMENT, this.#gl.RENDERBUFFER,
      renderbuffer);
    this.#gl.bindRenderbuffer(this.#gl.RENDERBUFFER, null);

    this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, null);
  }

  #createPathTexture() {
    if (!this.#pathFramebuffer)
      this.#createPathFramebuffer();
    this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, this.#pathFramebuffer);
    this.#drawPath();
    this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, null);
    this.#needToCreatePathTexture = false;
    this.#needToDrawHeightMap = true;
  }

  #drawHeightMap() {
    this.#gl.useProgram(this.#programs.heightMap);
    this.#gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.#gl.enable(this.#gl.DEPTH_TEST);
    const canvasSize = Math.min(this.#canvas.width, this.#canvas.height);
    this.#gl.viewport((this.#canvas.width - canvasSize) / 2,
                     (this.#canvas.height - canvasSize) / 2,
                     canvasSize, canvasSize);
    this.#gl.clear(this.#gl.COLOR_BUFFER_BIT | this.#gl.DEPTH_BUFFER_BIT);

    this.#gl.activeTexture(this.#gl.TEXTURE0);
    this.#gl.bindTexture(this.#gl.TEXTURE_2D, this.#pathRgbaTexture);

    this.#gl.uniform1f(this.#programs.heightMap.resolution, RESOLUTION);
    this.#gl.uniform1f(this.#programs.heightMap.pathScale, this.#pathScale);
    this.#gl.uniform1f(this.#programs.heightMap.pathMinZ, this.#pathMinZ);
    this.#gl.uniform1f(this.#programs.heightMap.pathTopZ, this.#pathTopZ);
    this.#gl.uniformMatrix4fv(
      this.#programs.heightMap.rotate, false, this.#rotate);
    this.#gl.uniform1i(this.#programs.heightMap.heightMap, 0);

    this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, this.#meshBuffer);
    this.#gl.vertexAttribPointer(
      this.#programs.heightMap.pos0, 2, this.#gl.FLOAT, false,
      MESH_STRIDE * Float32Array.BYTES_PER_ELEMENT, 0);
    this.#gl.vertexAttribPointer(
      this.#programs.heightMap.pos1, 2, this.#gl.FLOAT, false,
      MESH_STRIDE * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT);
    this.#gl.vertexAttribPointer(
      this.#programs.heightMap.pos2, 2, this.#gl.FLOAT, false,
      MESH_STRIDE * Float32Array.BYTES_PER_ELEMENT,
      4 * Float32Array.BYTES_PER_ELEMENT);
    this.#gl.vertexAttribPointer(
      this.#programs.heightMap.thisPos, 2, this.#gl.FLOAT, false,
      MESH_STRIDE * Float32Array.BYTES_PER_ELEMENT,
      6 * Float32Array.BYTES_PER_ELEMENT);
    //this.#gl.vertexAttribPointer(this.#programs.heightMap.command, 1, this.#gl.FLOAT, false, MESH_STRIDE * Float32Array.BYTES_PER_ELEMENT, 8 * Float32Array.BYTES_PER_ELEMENT);

    this.#gl.enableVertexAttribArray(this.#programs.heightMap.pos0);
    this.#gl.enableVertexAttribArray(this.#programs.heightMap.pos1);
    this.#gl.enableVertexAttribArray(this.#programs.heightMap.pos2);
    this.#gl.enableVertexAttribArray(this.#programs.heightMap.thisPos);
    //this.#gl.enableVertexAttribArray(this.#programs.heightMap.command);

    this.#gl.drawArrays(this.#gl.TRIANGLES, 0, this.#meshNumVertices);

    this.#gl.disableVertexAttribArray(this.#programs.heightMap.pos0);
    this.#gl.disableVertexAttribArray(this.#programs.heightMap.pos1);
    this.#gl.disableVertexAttribArray(this.#programs.heightMap.pos2);
    this.#gl.disableVertexAttribArray(this.#programs.heightMap.thisPos);
    //this.#gl.disableVertexAttribArray(this.#programs.heightMap.command);

    this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, null);
    this.#gl.bindTexture(this.#gl.TEXTURE_2D, null);
    this.#gl.useProgram(null);

    this.#needToDrawHeightMap = false;
  }

  #drawCutter() {

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

    // interpolate between two numbers
    function mix(v0, v1, a) {
      return v0 + (v1 - v0) * a;
    }

    if (this.#pathNumPoints === 0) {
      //console.debug("Simulation.#drawCutter: no points");
      return;
    }

    const i = lowerBound(this.#pathBufferContent, 7,
                         this.#pathStride * this.#pathVerticesPerLine,
                         0, this.#pathNumPoints, this.#stopAt.t);
    let x, y, z;
    if (i < this.#pathNumPoints) {
      const offset = i * this.#pathStride * this.#pathVerticesPerLine;
      const beginTime = this.#pathBufferContent[offset + 6];
      const endTime = this.#pathBufferContent[offset + 7];
      let ratio;
      if (endTime === beginTime)
        ratio = 0;
      else
        ratio = (this.#stopAt.t - beginTime) / (endTime - beginTime);
      x = mix(this.#pathBufferContent[offset + 0],
              this.#pathBufferContent[offset + 3], ratio);
      y = mix(this.#pathBufferContent[offset + 1],
              this.#pathBufferContent[offset + 4], ratio);
      z = mix(this.#pathBufferContent[offset + 2],
              this.#pathBufferContent[offset + 5], ratio);
    }
    else {
      let offset = (i - 1) * this.#pathStride * this.#pathVerticesPerLine;
      x = this.#pathBufferContent[offset + 3];
      y = this.#pathBufferContent[offset + 4];
      z = this.#pathBufferContent[offset + 5];
    }

    this.#gl.useProgram(this.#programs.basic);

    // Set program variables
    this.#gl.uniform3f(this.#programs.basic.scale,
                      this.#cutterDiameter * this.#pathScale,
                      this.#cutterDiameter * this.#pathScale,
                      this.#cutterHeight * this.#pathScale);
    this.#gl.uniform3f(this.#programs.basic.translate,
                      (x + this.#pathXOffset) * this.#pathScale,
                      (y + this.#pathYOffset) * this.#pathScale,
                      (z - this.#pathTopZ) * this.#pathScale);
    this.#gl.uniformMatrix4fv(this.#programs.basic.rotate, false, this.#rotate);
    // Set the colour of the cutter according to the value of s. A stationary
    // cutter will be green, while a working cutter will be red
    if (this.#stopAt.s === 0)
      this.#gl.uniform4fv(this.#programs.basic.colour, [0, 0.7, 0, 1]);
    else
      this.#gl.uniform4fv(this.#programs.basic.colour, [0.8, 0, 0, 1]);

    this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, this.#cylBuffer);
    this.#gl.vertexAttribPointer(this.#programs.basic.vPos, 3,
                                this.#gl.FLOAT, false,
                                CYL_STRIDE * Float32Array.BYTES_PER_ELEMENT, 0);

    this.#gl.enableVertexAttribArray(this.#programs.basic.vPos);
    this.#gl.drawArrays(this.#gl.TRIANGLES, 0, this.#cylNumVertices);
    this.#gl.disableVertexAttribArray(this.#programs.basic.vPos);

    this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, null);
    this.#gl.useProgram(null);
  }

  #render() {
    this.#pendingRequest = true;

    if (this.#needToCreatePathTexture)
      this.#createPathTexture();

    if (this.#needToDrawHeightMap) {
      this.#drawHeightMap();
      this.#drawCutter();
    }

    this.#pendingRequest = false;
  }

  #interpolateToolPosition(t) {
    // TODO: use a binary search to find the encompassing timestep
    if (this.#timeSteps.length === 0)
      return { t: 0, x: 0, y: 0, z: 0, f: 0, s: 0 };
    let prev = this.#timeSteps[0];
    if (this.#timeSteps.length === 1)
      return prev;
    let curr;
    for (let i = 1; i < this.#timeSteps.length; i++) {
      curr = this.#timeSteps[i];
      if (curr.t >= t)
        break;
      prev = curr;
    }
    const dt = (t - prev.t) / (curr.t - prev.t);
    return {
      t: t,
      x: prev.x + dt * (curr.x - prev.x),
      y: prev.y + dt * (curr.y - prev.y),
      z: prev.z + dt * (curr.z - prev.z),
      f: prev.f,
      s: prev.s
    };
  }

  /**
   * Set the simulation stop time
   * @param {number} t the new stop time
   */
  #setStopAtTime(t) {
    const pos = this.#interpolateToolPosition(t);
    this.#stopAt = pos;
    if (typeof this.#stopWatch === "function")
      this.#stopWatch(pos);

    // Map the time to a tool position
    this.#needToCreatePathTexture = true;
    this.#requestFrame();
  }

  /**
   * Set the view rotation.
   */
  #setRotate(rot) {
    this.#rotate = rot;
    this.#needToDrawHeightMap = true;
    this.#requestFrame();
  }

  /**
   * Return a promise to load the given WebGL shader from a URI
   * @param {string} name shader to load
   * @param type gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
   * @return {Promise}
   */
  #loadShader(name, type) {
    const uri = `${this.#shaderURI}/${name}.glsl`;
    const gl = this.#gl;
    return fetch(uri)
    .then(response => response.text())
    .then(source => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      const mess = gl.getShaderInfoLog(shader);
      if (mess.length > 0)
        throw new Error(`Shader ${uri} compile failed ${mess}`);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        return shader;
      throw new Error(`Shader ${uri} didn't compile`);
    });
  }

  /**
   * We only add event listeners at the end of start(), when all
   * the shaders have been loaded.
   */
  #addEventListeners() {
    let mouseDown = false;
    let lastX = 0;
    let lastY = 0;
    const origRotate = mat4.create();

    this.#timeControl.addEventListener("input", e => {
      const stopAt = e.target.value / 1000 * this.#totalTime;
      this.#setStopAtTime(stopAt);
    });

    this.#canvas.addEventListener("mousedown", e => {
      e.preventDefault();
      mouseDown = true;
      lastX = e.pageX;
      lastY = e.pageY;
      mat4.copy(origRotate, this.#rotate);
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
      this.#setRotate(m);
    });

    document.addEventListener("mouseup", () => {
      mouseDown = false;
    });
  }

  /**
   * Set the path that is being simulated. All parameters use
   * gcode units.
   * @param {object[]} path array of path points, each an object { x,
   * y, z, f, s } where x,y,z are the coords, f is the cutter speed,
   * and s is the spindle speed.
   * @param {number} topZ top of the material
   * @param {number} cutterDiameter diameter of cutter head, in "integer".
   * @param {number} cutterAngle angle of V-cutter head, in radians measured
   * from the axis of rotation. Flat heads use PI/2.
   * @param {number} cutterHeight height of cutter cylinder, in "integer".
   */
  setPath(path, topZ, cutterDiameter, cutterAngle, cutterHeight) {

    this.#pathTopZ = topZ;
    this.#cutterDiameter = cutterDiameter;
    if (cutterAngle <= 0 || cutterAngle > Math.PI / 2)
      cutterAngle = Math.PI / 2;
    this.#cutterAngle = cutterAngle;
    this.#isVBit = cutterAngle < Math.PI / 2;
    this.#cutterHeight = cutterHeight;
    this.#needToCreatePathTexture = true;
    this.#requestFrame();
    this.#pathNumPoints = path.length;

    if (this.#isVBit) {
      this.#pathStride = 12;
      this.#pathVerticesPerLine = 12 + HALF_CIRCLE_SEGMENTS * 6;
    } else {
      this.#pathStride = 9;
      this.#pathVerticesPerLine = 18;
    }

    this.#pathNumVertices = this.#pathNumPoints * this.#pathVerticesPerLine;
    const buff = new Float32Array(
      this.#pathNumPoints * this.#pathStride * this.#pathVerticesPerLine);
    this.#pathBufferContent = buff;

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
    this.#timeSteps = [];
    for (const curr of path) {
      idx++;
      const dist = Math.sqrt((curr.x - prev.x) * (curr.x - prev.x)
                             + (curr.y - prev.y) * (curr.y - prev.y)
                             + (curr.z - prev.z) * (curr.z - prev.z));
      const beginTime = time;
      time = time + 60.0 * dist / curr.f;

      this.#timeSteps.push({
        t: time, x: curr.x, y: curr.y, z: curr.z, f: curr.f, s: curr.s });

      min.x = Math.min(min.x, curr.x);
      min.y = Math.min(min.y, curr.y);
      min.z = Math.min(min.z, curr.z);

      max.x = Math.max(max.x, curr.x);
      max.y = Math.max(max.y, curr.y);
      max.z = Math.max(max.z, curr.z);

      if (this.#isVBit)
        this.#vBit(idx, prev, curr, buff, beginTime, time);
      else
        this.#flatBit(idx, prev, curr, buff, beginTime, time);

      prev = curr;
    }
    this.#totalTime = time;

    this.#pathXOffset = -(min.x + max.x) / 2;
    this.#pathYOffset = -(min.y + max.y) / 2;
    const size = Math.max(max.x - min.x + 4 * this.#cutterDiameter,
                          max.y - min.y + 4 * this.#cutterDiameter);
    this.#pathScale = 2 / size;
    this.#pathMinZ = min.z;

    this.#setStopAtTime(0);
    this.#requestFrame();
  }
}


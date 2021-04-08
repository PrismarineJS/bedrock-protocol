/* global THREE */
const { Viewer, MapControls } = require('prismarine-viewer/viewer')
// const { Vec3 } = require('vec3')
const { ClientProvider } = require('./ClientProvider')
// const { ProxyProvider } = require('./ProxyProvider')
global.THREE = require('three')

const MCVER = '1.16.1'

class BotViewer {
  start () {
    this.bot = new ClientProvider()
    // this.bot = new ProxyProvider()
    // Create three.js context, add to page
    this.renderer = new THREE.WebGLRenderer()
    this.renderer.setPixelRatio(window.devicePixelRatio || 1)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(this.renderer.domElement)

    // Create viewer
    this.viewer = new Viewer(this.renderer)
    this.viewer.setVersion(MCVER)
    // Attach controls to viewer
    this.controls = new MapControls(this.viewer.camera, this.renderer.domElement)
    // Enable damping (inertia) on movement
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.09
    console.info('Registered handlers')
    // Link WorldView and Viewer
    this.viewer.listen(this.bot)

    this.bot.on('spawn', ({ position, firstPerson }) => {
      // Initialize viewer, load chunks
      this.bot.init(position)
      // Start listening for keys
      this.registerBrowserEvents()

      if (firstPerson && this.bot.movements) {
        this.viewer.camera.position.set(position.x, position.y, position.z)
        this.firstPerson = true
        this.controls.enabled = false
      } else {
        this.viewer.camera.position.set(position.x, position.y, position.z)
      }
    })

    this.bot.on('playerMove', (id, pos) => {
      if (this.firstPerson && id < 10) {
        this.setFirstPersonCamera(pos)
        return
      }

      window.viewer.viewer.entities.update({
        name: 'player',
        id,
        pos: pos.position,
        width: 0.6,
        height: 1.8,
        yaw: pos.yaw,
        pitch: pos.pitch
      })
    })

    const oldFov = this.viewer.camera.fov
    const sprintFov = this.viewer.camera.fov + 20
    const sneakFov = this.viewer.camera.fov - 10

    const onSprint = () => {
      this.viewer.camera.fov = sprintFov
      this.viewer.camera.updateProjectionMatrix()
    }

    const onSneak = () => {
      this.viewer.camera.fov = sneakFov
      this.viewer.camera.updateProjectionMatrix()
    }

    const onRelease = () => {
      this.viewer.camera.fov = oldFov
      this.viewer.camera.updateProjectionMatrix()
    }

    this.bot.on('startSprint', onSprint)
    this.bot.on('startSneak', onSneak)
    this.bot.on('stopSprint', onRelease)
    this.bot.on('stopSneak', onRelease)

    this.controls.update()

    // Browser animation loop
    const animate = () => {
      window.requestAnimationFrame(animate)
      if (this.controls && !this.firstPerson) this.controls.update()
      this.viewer.update()
      this.renderer.render(this.viewer.scene, this.viewer.camera)
    }
    animate()

    window.addEventListener('resize', () => {
      this.viewer.camera.aspect = window.innerWidth / window.innerHeight
      this.viewer.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })
  }

  onMouseMove = (e) => {
    if (this.firstPerson) {
      this.bot.entity.pitch -= e.movementY * 0.005
      this.bot.entity.yaw -= e.movementX * 0.004
    }
  }

  onPointerLockChange = () => {
    const e = this.renderer.domElement
    if (document.pointerLockElement === e) {
      e.parentElement.addEventListener('mousemove', this.onMouseMove, { passive: true })
    } else {
      e.parentElement.removeEventListener('mousemove', this.onMouseMove, false)
    }
  }

  onMouseDown = () => {
    if (this.firstPerson && !document.pointerLockElement) {
      this.renderer.domElement.requestPointerLock()
    }
  }

  registerBrowserEvents () {
    const e = this.renderer.domElement
    e.parentElement.addEventListener('keydown', this.bot.onKeyDown)
    e.parentElement.addEventListener('keyup', this.bot.onKeyUp)
    e.parentElement.addEventListener('mousedown', this.onMouseDown)
    document.addEventListener('pointerlockchange', this.onPointerLockChange, false)
  }

  unregisterBrowserEvents () {
    const e = this.renderer.domElement
    e.parentElement.removeEventListener('keydown', this.bot.onKeyDown)
    e.parentElement.removeEventListener('keyup', this.bot.onKeyUp)
    e.parentElement.removeEventListener('mousemove', this.onMouseMove)
    e.parentElement.removeEventListener('mousedown', this.onMouseDown)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange, false)
  }

  setFirstPersonCamera (entity) {
    this.viewer.setFirstPersonCamera(entity.position, entity.yaw, entity.pitch * 2)
  }
}

module.exports = { BotViewer }

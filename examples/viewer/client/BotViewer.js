/* global THREE */
const { Viewer, MapControls } = require('prismarine-viewer/viewer')
// const { Vec3 } = require('vec3')
// const { BotProvider } = require('./BotProvider')
const { ProxyProvider } = require('./ProxyProvider')
global.THREE = require('three')

const MCVER = '1.16.1'

class BotViewer {
  start () {
    // this.bot = new BotProvider()
    this.bot = new ProxyProvider()
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
        this.firstPerson = true
      } else {
        this.viewer.camera.position.set(position.x, position.y, position.z)
      }
    })

    this.bot.on('playerMove', (id, pos) => {
      if (this.firstPerson && id === 1) {
        this.setFirstPersonCamera(pos)
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

  onKeyDown = (evt) => {
    console.log('Key down', evt)
  }

  registerBrowserEvents () {
    this.renderer.domElement.parentElement.addEventListener('keydown', this.onKeyDown)
  }

  setFirstPersonCamera (entity) {
    this.viewer.setFirstPersonCamera(entity.position, entity.yaw, entity.pitch * 2)
  }
}

module.exports = { BotViewer }

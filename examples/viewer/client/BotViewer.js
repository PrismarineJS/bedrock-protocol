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

    this.bot.on('spawn', ({ position }) => {
      // Initialize viewer, load chunks
      this.bot.init(position)
      // Start listening for keys
      this.registerBrowserEvents()
    })

    this.controls.update()

    // Browser animation loop
    const animate = () => {
      window.requestAnimationFrame(animate)
      if (this.controls) this.controls.update()
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
}

module.exports = { BotViewer }

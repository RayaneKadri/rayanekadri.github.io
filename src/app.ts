import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
import '@babylonjs/loaders/glTF';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  FreeCamera,
  Color4,
  Matrix,
  Quaternion,
  SceneLoader,
  Color3,
  StandardMaterial,
  ShadowGenerator,
  PointLight,
} from '@babylonjs/core';
import { AdvancedDynamicTexture, Button, Control } from '@babylonjs/gui';
import { Player } from './classes/characterController';
import { Environment } from './environment';

enum State {
  START = 0,
  GAME = 1,
  LOSE = 2,
  CUTSCENE = 3,
}

class App {
  // General Entire Application
  public assets;
  private _scene: Scene;
  private _canvas: HTMLCanvasElement;
  private _engine: Engine;

  //Scene - related
  private _state: number = 0;
  private _gamescene: Scene;
  private _cutScene: Scene;
  private _player: Player;
  private _environment: Environment;

  constructor() {
    this._canvas = this._createCanvas();

    // initialize babylon scene and engine
    this._engine = new Engine(this._canvas, true);
    this._scene = new Scene(this._engine);

    // hide/show the Inspector
    window.addEventListener('keydown', (ev) => {
      // Shift+Ctrl+Alt+I
      if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
        if (this._scene.debugLayer.isVisible()) {
          this._scene.debugLayer.hide();
        } else {
          this._scene.debugLayer.show();
        }
      }
    });

    // run the main render loop
    this._main();
  }

  private _createCanvas(): HTMLCanvasElement {
    //Commented out for development
    document.documentElement.style['overflow'] = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.padding = '0';

    //create the canvas html element and attach it to the webpage
    this._canvas = document.createElement('canvas');
    this._canvas.style.width = '100%';
    this._canvas.style.height = '100%';
    this._canvas.id = 'gameCanvas';
    document.body.appendChild(this._canvas);

    return this._canvas;
  }

  private async _main(): Promise<void> {
    await this._goToStart();

    // Register a render loop to repeatedly render the scene
    this._engine.runRenderLoop(() => {
      switch (this._state) {
        case State.START:
          this._scene.render();
          break;
        case State.CUTSCENE:
          this._scene.render();
          break;
        case State.GAME:
          this._scene.render();
          break;
        case State.LOSE:
          this._scene.render();
          break;
        default:
          break;
      }
    });

    //resize if the screen is resized/rotated
    window.addEventListener('resize', () => {
      this._engine.resize();
    });
  }
  private async _goToStart() {
    this._engine.displayLoadingUI();

    this._scene.detachControl();
    let scene = new Scene(this._engine);
    scene.clearColor = new Color4(0, 0, 0, 1);
    let camera = new FreeCamera('camera1', new Vector3(0, 0, 0), scene);
    camera.setTarget(Vector3.Zero());

    //create a fullscreen ui for all of our GUI elements
    const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI('UI');
    guiMenu.idealHeight = 720; //fit our fullscreen ui to this height

    //create a simple button
    const startBtn = Button.CreateSimpleButton('start', 'PLAY');
    startBtn.width = 0.2;
    startBtn.height = '40px';
    startBtn.color = 'white';
    startBtn.top = '-14px';
    startBtn.thickness = 0;
    startBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    guiMenu.addControl(startBtn);

    //this handles interactions with the start button attached to the scene
    startBtn.onPointerDownObservable.add(() => {
      this._goToCutScene();
      scene.detachControl(); //observables disabled
    });

    //--SCENE FINISHED LOADING--
    await scene.whenReadyAsync();
    this._engine.hideLoadingUI();
    //lastly set the current state to the start state and set the scene to the start scene
    this._scene.dispose();
    this._scene = scene;
    this._state = State.START;
  }

  private async _goToCutScene(): Promise<void> {
    this._engine.displayLoadingUI();
    //--SETUP SCENE--
    //dont detect any inputs from this ui while the game is loading
    this._scene.detachControl();
    this._cutScene = new Scene(this._engine);
    let camera = new FreeCamera('camera1', new Vector3(0, 0, 0), this._cutScene);
    camera.setTarget(Vector3.Zero());
    this._cutScene.clearColor = new Color4(0, 0, 0, 1);

    //--GUI--
    const cutScene = AdvancedDynamicTexture.CreateFullscreenUI('cutscene');

    //--PROGRESS DIALOGUE--
    const next = Button.CreateSimpleButton('next', 'NEXT');
    next.color = 'white';
    next.thickness = 0;
    next.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    next.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    next.width = '64px';
    next.height = '64px';
    next.top = '-3%';
    next.left = '-12%';
    cutScene.addControl(next);

    next.onPointerUpObservable.add(() => {
      this._goToGame();
    });

    //--WHEN SCENE IS FINISHED LOADING--
    await this._cutScene.whenReadyAsync();
    this._engine.hideLoadingUI();
    this._scene.dispose();
    this._state = State.CUTSCENE;
    this._scene = this._cutScene;

    //--START LOADING AND SETTING UP THE GAME DURING THIS SCENE--
    var finishedLoading = false;
    await this._setUpGame().then((res) => {
      finishedLoading = true;
    });
  }

  private async _loadCharacterAssets(scene): Promise<any> {
    async function loadCharacter() {
      //collision mesh
      const outer = MeshBuilder.CreateBox('outer', { width: 2, depth: 1, height: 3 }, scene);
      outer.isVisible = false;
      outer.isPickable = false;
      outer.checkCollisions = true;

      //move origin of box collider to the bottom of the mesh (to match player mesh)
      outer.bakeTransformIntoVertices(Matrix.Translation(0, 1.5, 0));
      //for collisions
      outer.ellipsoid = new Vector3(1, 1.5, 1);
      outer.ellipsoidOffset = new Vector3(0, 1.5, 0);

      outer.rotationQuaternion = new Quaternion(0, 1, 0, 0); // rotate the player mesh 180 since we want to see the back of the player
      var box = MeshBuilder.CreateBox(
        'Small1',
        {
          width: 0.5,
          depth: 0.5,
          height: 0.25,
          faceColors: [
            new Color4(0, 0, 0, 1),
            new Color4(0, 0, 0, 1),
            new Color4(0, 0, 0, 1),
            new Color4(0, 0, 0, 1),
            new Color4(0, 0, 0, 1),
            new Color4(0, 0, 0, 1),
          ],
        },
        scene,
      );
      box.position.y = 1.5;
      box.position.z = 1;

      //--IMPORTING MESH--
      return SceneLoader.ImportMeshAsync(null, './models/', 'player.glb', scene).then((result) => {
        const root = result.meshes[0];
        //body is our actual player mesh
        const body = root;
        body.parent = outer;
        body.isPickable = false;
        body.getChildMeshes().forEach((m) => {
          m.isPickable = false;
        });

        //return the mesh and animations
        return {
          mesh: outer as Mesh,
          animationGroups: result.animationGroups,
        };
      });
    }

    return loadCharacter().then((assets) => {
      this.assets = assets;
    });
  }

  private async _initializeGameAsync(scene): Promise<void> {
    //temporary light to light the entire scene
    var light0 = new HemisphericLight('HemiLight', new Vector3(0, 1, 0), scene);

    const light = new PointLight('sparklight', new Vector3(0, 0, 0), scene);
    light.diffuse = new Color3(0.08627450980392157, 0.10980392156862745, 0.15294117647058825);
    light.intensity = 35;
    light.radius = 1;

    const shadowGenerator = new ShadowGenerator(1024, light);
    shadowGenerator.darkness = 0.4;

    //Create the player
    this._player = new Player(this.assets, scene, shadowGenerator); //dont have inputs yet so we dont need to pass it in
  }

  private async _setUpGame() {
    let scene = new Scene(this._engine);
    this._gamescene = scene;
    await this._loadCharacterAssets(scene);

    //...load assets
  }

  private async _goToGame() {
    //--SETUP SCENE--
    this._scene.detachControl();
    let scene = this._gamescene;
    await this._initializeGameAsync(scene);

    //--GUI--
    const playerUI = AdvancedDynamicTexture.CreateFullscreenUI('UI');
    scene.detachControl();

    //--CREATE ENVIRONMENT--
    const environment = new Environment(scene);
    this._environment = environment; //class variable for App
    await this._environment.load(); //environment

    //--WHEN SCENE FINISHED LOADING--
    await scene.whenReadyAsync();
    scene.getMeshByName('outer').position = new Vector3(0, 3, 0);
    //get rid of start scene, switch to gamescene and change states
    this._scene.dispose();
    this._state = State.GAME;
    this._scene = scene;
    this._engine.hideLoadingUI();
    //the game is ready, attach control back
    this._scene.attachControl();
  }

  private async _goToLose(): Promise<void> {
    this._engine.displayLoadingUI();

    //--SCENE SETUP--
    this._scene.detachControl();
    let scene = new Scene(this._engine);
    scene.clearColor = new Color4(0, 0, 0, 1);
    let camera = new FreeCamera('camera1', new Vector3(0, 0, 0), scene);
    camera.setTarget(Vector3.Zero());

    //--GUI--
    const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI('UI');
    const mainBtn = Button.CreateSimpleButton('mainmenu', 'MAIN MENU');
    mainBtn.width = 0.2;
    mainBtn.height = '40px';
    mainBtn.color = 'white';
    guiMenu.addControl(mainBtn);
    //this handles interactions with the start button attached to the scene
    mainBtn.onPointerUpObservable.add(() => {
      this._goToStart();
    });

    //--SCENE FINISHED LOADING--
    await scene.whenReadyAsync();
    this._engine.hideLoadingUI(); //when the scene is ready, hide loading
    //lastly set the current state to the lose state and set the scene to the lose scene
    this._scene.dispose();
    this._scene = scene;
    this._state = State.LOSE;
  }
}
new App();

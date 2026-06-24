const canvas = document.getElementById('swarm-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- CONTROLES DE LA INTERFAZ ---
const sliderSep = document.getElementById('slider-sep');
const sliderAli = document.getElementById('slider-ali');
const sliderCoh = document.getElementById('slider-coh');
const sliderPercepcion = document.getElementById('slider-percepcion');
const btnReset = document.getElementById('btn-reset');

let obstacles = [];

// --- CLASE AGENTE (BOID) ---
class Agent {
    constructor(x, y) {
        this.position = { x: x, y: y };
        // Velocidad aleatoria inicial
        let angle = Math.random() * Math.PI * 2;
        this.velocity = { x: Math.cos(angle) * 2, y: Math.sin(angle) * 2 };
        this.acceleration = { x: 0, y: 0 };
        this.maxSpeed = 3.5;
        this.maxForce = 0.15;
    }

    update() {
        // Actualizar velocidad con la aceleración calculada
        this.velocity.x += this.acceleration.x;
        this.velocity.y += this.acceleration.y;

        // Limitar a velocidad máxima
        let speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        if (speed > this.maxSpeed) {
            this.velocity.x = (this.velocity.x / speed) * this.maxSpeed;
            this.velocity.y = (this.velocity.y / speed) * this.maxSpeed;
        }

        // Modificar posición
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // Resetear aceleración en cada ciclo
        this.acceleration.x = 0;
        this.acceleration.y = 0;

        // Atravesar los bordes de la pantalla (Modo toroidal continuo)
        if (this.position.x < 0) this.position.x = canvas.width;
        if (this.position.x > canvas.width) this.position.x = 0;
        if (this.position.y < 0) this.position.y = canvas.height;
        if (this.position.y > canvas.height) this.position.y = 0;
    }

    applyForce(force) {
        this.acceleration.x += force.x;
        this.acceleration.y += force.y;
    }

    // --- CÁLCULO DE LAS 3 REGLAS COMPUTACIONALES ---
    flock(agents) {
        let perceptionRadius = parseFloat(sliderPercepcion.value);
        
        let sepForce = { x: 0, y: 0 };
        let aliForce = { x: 0, y: 0 };
        let cohForce = { x: 0, y: 0 };

        let totalNeighbors = 0;

        for (let other of agents) {
            let dx = other.position.x - this.position.x;
            let dy = other.position.y - this.position.y;
            let d = Math.sqrt(dx * dx + dy * dy);

            if (other !== this && d < perceptionRadius) {
                // 1. Acumular Separación (Fuerza inversamente proporcional a la distancia)
                sepForce.x -= dx / (d * d);
                sepForce.y -= dy / (d * d);

                // 2. Acumular Alineación
                aliForce.x += other.velocity.x;
                aliForce.y += other.velocity.y;

                // 3. Acumular Cohesión (Sumar posiciones vecinales)
                cohForce.x += other.position.x;
                cohForce.y += other.position.y;

                totalNeighbors++;
            }
        }

        if (totalNeighbors > 0) {
            // Promediar y normalizar fuerzas según pesos de los sliders
            aliForce.x /= totalNeighbors;
            aliForce.y /= totalNeighbors;
            this.steerTowards(aliForce, parseFloat(sliderAli.value) * 0.5);

            cohForce.x /= totalNeighbors;
            cohForce.y /= totalNeighbors;
            // El vector de cohesión va desde la posición actual hacia la posición promedio vecinal
            cohForce.x -= this.position.x;
            cohForce.y -= this.position.y;
            this.steerTowards(cohForce, parseFloat(sliderCoh.value) * 0.3);

            this.steerTowards(sepForce, parseFloat(sliderSep.value) * 1.5);
        }

        // Evitar obstáculos colocados con el mouse
        this.avoidObstacles();
    }

    steerTowards(target, weight) {
        let mag = Math.sqrt(target.x ** 2 + target.y ** 2);
        if (mag > 0) {
            target.x = (target.x / mag) * this.maxSpeed - this.velocity.x;
            target.y = (target.y / mag) * this.maxSpeed - this.velocity.y;
            
            // Limitar la fuerza de giro
            let fMag = Math.sqrt(target.x ** 2 + target.y ** 2);
            if (fMag > this.maxForce) {
                target.x = (target.x / fMag) * this.maxForce;
                target.y = (target.y / fMag) * this.maxForce;
            }

            this.applyForce({ x: target.x * weight, y: target.y * weight });
        }
    }

    avoidObstacles() {
        for (let obs of obstacles) {
            let dx = this.position.x - obs.x;
            let dy = this.position.y - obs.y;
            let d = Math.sqrt(dx * dx + dy * dy);

            if (d < obs.radius + 40) {
                let force = { x: dx / d, y: dy / d };
                this.steerTowards(force, 2.5); // Fuerza de repulsión crítica
            }
        }
    }

    draw() {
        let angle = Math.atan2(this.velocity.y, this.velocity.x);
        
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(angle);

        // Dibujar agente como un vector triangular estilizado de neón cian
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, -4);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, 4);
        ctx.closePath();
        
        ctx.fillStyle = '#00f3ff';
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.restore();
    }
}

// --- CONFIGURACIÓN DE LA MATRIZ DE AGENTES ---
let agents = [];
function initSwarm() {
    agents = [];
    obstacles = [];
    for (let i = 0; i < 160; i++) {
        agents.push(new Agent(Math.random() * canvas.width, Math.random() * canvas.height));
    }
}

// Interacción para colocar obstáculos repulsores
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    obstacles.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        radius: 25
    });
    if (obstacles.length > 4) obstacles.shift(); // Conservar máximo 4 obstáculos
});

btnReset.addEventListener('click', initSwarm);

// --- BUCLE DE ANIMACIÓN DINÁMICO ---
function animate() {
    // TRUCO DE COMPUTATIONAL DESIGN: En lugar de borrar todo el canvas con clearRect,
    // dibujamos un rectángulo negro con una opacidad del 10% (0.1). Esto hace que
    // las posiciones anteriores de los agentes se desvanezcan lentamente, creando
    // un rastro cinético espectacular estilo barrido de luz.
    ctx.fillStyle = 'rgba(5, 1, 7, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Actualizar valores numéricos en el HUD
    document.getElementById('val-sep').innerText = parseFloat(sliderSep.value).toFixed(1);
    document.getElementById('val-ali').innerText = parseFloat(sliderAli.value).toFixed(1);
    document.getElementById('val-coh').innerText = parseFloat(sliderCoh.value).toFixed(1);
    document.getElementById('val-percepcion').innerText = sliderPercepcion.value;

    // Dibujar obstáculos activos
    for (let obs of obstacles) {
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 0, 85, 0.25)';
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.stroke();
    }
    ctx.shadowBlur = 0; // Limpiar sombra para los agentes

    // Ejecutar lógica de enjambre y actualizar agentes
    for (let agent of agents) {
        agent.flock(agents);
        agent.update();
        agent.draw();
    }

    requestAnimationFrame(animate);
}

// Iniciar simulación
initSwarm();
animate();

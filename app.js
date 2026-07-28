const canvas = document.getElementById('swarm-canvas');
const ctx = canvas.getContext('2d');
const btnToggleHud = document.getElementById('btn-toggle-hud');
const hudContainer = document.getElementById('hud-container');

btnToggleHud.addEventListener('click', () => {
    hudContainer.classList.toggle('minimized');
    if (hudContainer.classList.contains('minimized')) {
        btnToggleHud.innerText = "[+ CONTROL_SYS]";
    } else {
        btnToggleHud.innerText = "_ MINIMIZE";
    }
});
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- UI CONTROLS & DOM ELEMENTS ---
const sliderSep = document.getElementById('slider-sep');
const sliderAli = document.getElementById('slider-ali');
const sliderCoh = document.getElementById('slider-coh');
const sliderPercepcion = document.getElementById('slider-percepcion');
const btnReset = document.getElementById('btn-reset');

const btnToggleHud = document.getElementById('btn-toggle-hud');
const hudContainer = document.getElementById('hud-container');

let obstacles = [];

// --- MINIMIZE / MAXIMIZE HUD LOGIC ---
btnToggleHud.addEventListener('click', () => {
    hudContainer.classList.toggle('minimized');
    if (hudContainer.classList.contains('minimized')) {
        btnToggleHud.innerText = "[+ CONTROL_SYS]";
    } else {
        btnToggleHud.innerText = "_ MINIMIZE";
    }
});

// --- AGENT CLASS (BOID) ---
class Agent {
    constructor(x, y) {
        this.position = { x: x, y: y };
        let angle = Math.random() * Math.PI * 2;
        this.velocity = { x: Math.cos(angle) * 2, y: Math.sin(angle) * 2 };
        this.acceleration = { x: 0, y: 0 };
        this.maxSpeed = 3.5;
        this.maxForce = 0.15;
    }

    update() {
        this.velocity.x += this.acceleration.x;
        this.velocity.y += this.acceleration.y;

        let speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        if (speed > this.maxSpeed) {
            this.velocity.x = (this.velocity.x / speed) * this.maxSpeed;
            this.velocity.y = (this.velocity.y / speed) * this.maxSpeed;
        }

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        this.acceleration.x = 0;
        this.acceleration.y = 0;

        if (this.position.x < 0) this.position.x = canvas.width;
        if (this.position.x > canvas.width) this.position.x = 0;
        if (this.position.y < 0) this.position.y = canvas.height;
        if (this.position.y > canvas.height) this.position.y = 0;
    }

    applyForce(force) {
        this.acceleration.x += force.x;
        this.acceleration.y += force.y;
    }

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
                sepForce.x -= dx / (d * d);
                sepForce.y -= dy / (d * d);

                aliForce.x += other.velocity.x;
                aliForce.y += other.velocity.y;

                cohForce.x += other.position.x;
                cohForce.y += other.position.y;

                totalNeighbors++;
            }
        }

        if (totalNeighbors > 0) {
            aliForce.x /= totalNeighbors;
            aliForce.y /= totalNeighbors;
            this.steerTowards(aliForce, parseFloat(sliderAli.value) * 0.5);

            cohForce.x /= totalNeighbors;
            cohForce.y /= totalNeighbors;
            cohForce.x -= this.position.x;
            cohForce.y -= this.position.y;
            this.steerTowards(cohForce, parseFloat(sliderCoh.value) * 0.3);

            this.steerTowards(sepForce, parseFloat(sliderSep.value) * 1.5);
        }

        this.avoidObstacles();
    }

    steerTowards(target, weight) {
        let mag = Math.sqrt(target.x ** 2 + target.y ** 2);
        if (mag > 0) {
            target.x = (target.x / mag) * this.maxSpeed - this.velocity.x;
            target.y = (target.y / mag) * this.maxSpeed - this.velocity.y;
            
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
                this.steerTowards(force, 2.5);
            }
        }
    }

    draw() {
        let angle = Math.atan2(this.velocity.y, this.velocity.x);
        
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(angle);

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

// --- INITIALIZE SWARM ---
let agents = [];
function initSwarm() {
    agents = [];
    obstacles = [];
    for (let i = 0; i < 160; i++) {
        agents.push(new Agent(Math.random() * canvas.width, Math.random() * canvas.height));
    }
}

// Canvas click interaction for obstacles
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    obstacles.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        radius: 25
    });
    if (obstacles.length > 4) obstacles.shift();
});

btnReset.addEventListener('click', initSwarm);

// --- ANIMATION LOOP ---
function animate() {
    ctx.fillStyle = 'rgba(5, 1, 7, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    document.getElementById('val-sep').innerText = parseFloat(sliderSep.value).toFixed(1);
    document.getElementById('val-ali').innerText = parseFloat(sliderAli.value).toFixed(1);
    document.getElementById('val-coh').innerText = parseFloat(sliderCoh.value).toFixed(1);
    document.getElementById('val-percepcion').innerText = sliderPercepcion.value;

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
    ctx.shadowBlur = 0;

    for (let agent of agents) {
        agent.flock(agents);
        agent.update();
        agent.draw();
    }

    requestAnimationFrame(animate);
}

initSwarm();
animate();
// Iniciar simulación
initSwarm();
animate();

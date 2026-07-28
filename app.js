const canvas = document.getElementById('swarm-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- DOM & UI ELEMENTS ---
const sliderSep = document.getElementById('slider-sep');
const sliderAli = document.getElementById('slider-ali');
const sliderCoh = document.getElementById('slider-coh');
const sliderPercepcion = document.getElementById('slider-percepcion');
const btnReset = document.getElementById('btn-reset');
const btnClearWalls = document.getElementById('btn-clear-walls');
const btnToggleHud = document.getElementById('btn-toggle-hud');
const hudContainer = document.getElementById('hud-container');

// Arreglos de obstáculos permanentes
let walls = [];     // Líneas continuas
let circles = [];   // Puntos fijos

let isMouseDown = false;
let isDragging = false;
let currentCircleIndex = null; // Para saber qué punto borrar si el usuario decide arrastrar
let startX = 0;
let startY = 0;
let lastX = 0;
let lastY = 0;

// --- TOGGLE HUD ---
btnToggleHud.addEventListener('click', () => {
    hudContainer.classList.toggle('minimized');
    btnToggleHud.innerText = hudContainer.classList.contains('minimized') 
        ? "[+ CONTROL_SYS]" 
        : "_ MINIMIZE";
});

function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

// --- SISTEMA CORREGIDO DE REGISTRO INSTANTÁNEO ---
window.addEventListener('mousedown', (e) => {
    // Si hacemos clic en el HUD o en el botón de minimizar, ignoramos
    if (e.target.closest('#hud-container') || e.target.closest('#btn-toggle-hud')) return;

    const pos = getCanvasPos(e);
    isMouseDown = true;
    isDragging = false;
    
    startX = pos.x;
    startY = pos.y;
    lastX = pos.x;
    lastY = pos.y;

    // TRUCO DE REDRAW: Agregamos el punto INMEDIATAMENTE al hacer clic.
    // Si el usuario no se mueve, este punto ya queda permanente.
    circles.push({ x: startX, y: startY, radius: 18 });
    currentCircleIndex = circles.length - 1;
});

window.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;

    const pos = getCanvasPos(e);
    let dxFromStart = pos.x - startX;
    let dyFromStart = pos.y - startY;
    let distFromStart = Math.sqrt(dxFromStart * dxFromStart + dyFromStart * dyFromStart);

    // Si el usuario arrastra más de 6 píxeles, cancelamos el punto y lo convertimos en línea
    if (distFromStart > 6) {
        if (!isDragging) {
            isDragging = true;
            // Eliminamos el punto provisional que creamos en mousedown
            if (currentCircleIndex !== null && circles[currentCircleIndex]) {
                circles.splice(currentCircleIndex, 1);
                currentCircleIndex = null;
            }
        }

        let dx = pos.x - lastX;
        let dy = pos.y - lastY;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 3) {
            walls.push({
                x1: lastX,
                y1: lastY,
                x2: pos.x,
                y2: pos.y
            });
            lastX = pos.x;
            lastY = pos.y;
        }
    }
});

window.addEventListener('mouseup', () => {
    isMouseDown = false;
    isDragging = false;
    currentCircleIndex = null;
});

// --- HELPER MATEMÁTICO ---
function getClosestPointOnSegment(p, a, b) {
    let ab = { x: b.x - a.x, y: b.y - a.y };
    let ap = { x: p.x - a.x, y: p.y - a.y };
    let abLenSq = ab.x * ab.x + ab.y * ab.y;
    
    if (abLenSq === 0) return { x: a.x, y: a.y };

    let t = (ap.x * ab.x + ap.y * ab.y) / abLenSq;
    t = Math.max(0, Math.min(1, t));

    return {
        x: a.x + t * ab.x,
        y: a.y + t * ab.y
    };
}

// --- CLASE AGENTE (BOID) ---
class Agent {
    constructor(x, y) {
        this.position = { x: x, y: y };
        let angle = Math.random() * Math.PI * 2;
        this.velocity = { x: Math.cos(angle) * 2, y: Math.sin(angle) * 2 };
        this.acceleration = { x: 0, y: 0 };
        this.maxSpeed = 3.5;
        this.maxForce = 0.2;
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
        // 1. Repulsión y Colisión con Puntos (Círculos)
        for (let c of circles) {
            let dx = this.position.x - c.x;
            let dy = this.position.y - c.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < c.radius + 35 && dist > 0) {
                let pushForce = { x: dx / dist, y: dy / dist };
                this.steerTowards(pushForce, 3.0);
            }

            if (dist < c.radius + 8 && dist > 0) {
                let nx = dx / dist;
                let ny = dy / dist;
                this.position.x = c.x + nx * (c.radius + 8);
                this.position.y = c.y + ny * (c.radius + 8);
            }
        }

        // 2. Repulsión y Colisión con Paredes (Líneas)
        const avoidDistance = 35;
        for (let wall of walls) {
            let a = { x: wall.x1, y: wall.y1 };
            let b = { x: wall.x2, y: wall.y2 };

            let closest = getClosestPointOnSegment(this.position, a, b);
            let dx = this.position.x - closest.x;
            let dy = this.position.y - closest.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < avoidDistance && dist > 0) {
                let pushForce = { x: dx / dist, y: dy / dist };
                let strength = (1 - dist / avoidDistance) * 3.5;
                this.steerTowards(pushForce, strength);
            }

            const minDist = 10;
            if (dist < minDist && dist > 0) {
                let nx = dx / dist;
                let ny = dy / dist;
                this.position.x = closest.x + nx * minDist;
                this.position.y = closest.y + ny * minDist;

                let dot = this.velocity.x * nx + this.velocity.y * ny;
                if (dot < 0) {
                    this.velocity.x -= 1.8 * dot * nx;
                    this.velocity.y -= 1.8 * dot * ny;
                }
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

// --- INICIALIZACIÓN ---
let agents = [];
function initSwarm() {
    agents = [];
    for (let i = 0; i < 160; i++) {
        agents.push(new Agent(Math.random() * canvas.width, Math.random() * canvas.height));
    }
}

btnReset.addEventListener('click', initSwarm);
btnClearWalls.addEventListener('click', () => { 
    walls = []; 
    circles = [];
});

// --- BUCLE DE ANIMACIÓN (REDRAW CONSTANTE) ---
function animate() {
    // Fondo semitransparente para estela de partículas
    ctx.fillStyle = 'rgba(5, 1, 7, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    document.getElementById('val-sep').innerText = parseFloat(sliderSep.value).toFixed(1);
    document.getElementById('val-ali').innerText = parseFloat(sliderAli.value).toFixed(1);
    document.getElementById('val-coh').innerText = parseFloat(sliderCoh.value).toFixed(1);
    document.getElementById('val-percepcion').innerText = sliderPercepcion.value;

    // RENDERIZAR PUNTOS (Se dibujan explícitamente en CADA FRAME sobre el fondo)
    for (let c of circles) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 0, 85, 0.35)';
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    // RENDERIZAR PAREDES
    if (walls.length > 0) {
        ctx.save();
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 12;
        ctx.lineCap = 'round';

        ctx.beginPath();
        for (let wall of walls) {
            ctx.moveTo(wall.x1, wall.y1);
            ctx.lineTo(wall.x2, wall.y2);
        }
        ctx.stroke();
        ctx.restore();
    }

    // Actualizar y dibujar agentes
    for (let agent of agents) {
        agent.flock(agents);
        agent.update();
        agent.draw();
    }

    requestAnimationFrame(animate);
}

initSwarm();
animate();

// ==========================================
// 1. 별 생성 (건드리지 않음)
// ==========================================
const starsContainer = document.getElementById('stars');
const starCount = 180;

class Star {
    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'star';
        this.x = Math.random() * 100;
        this.y = Math.random() * 100;
        this.size = Math.random() * 2 + 0.5;
        this.opacity = Math.random() * 0.6 + 0.3;
        this.duration = Math.random() * 3 + 2;
        
        this.element.style.left = this.x + '%';
        this.element.style.top = this.y + '%';
        this.element.style.width = this.size + 'px';
        this.element.style.height = this.size + 'px';
        this.element.style.opacity = this.opacity;
        this.element.style.animation = `twinkle ${this.duration}s ease-in-out infinite`; 
        this.element.style.animationDelay = Math.random() * 3 + 's';
        
        if (starsContainer) {
            starsContainer.appendChild(this.element);
        }
    }
}
if (starsContainer) {
    for (let i = 0; i < starCount; i++) { new Star(); }
}

// ==========================================
// 2. 페이지 등장 애니메이션 (간격 수정됨 🐢)
// ==========================================
function playEnterAnimation() {
    const title = document.querySelector('.title'); 
    const elements = document.querySelectorAll('.btn, .input-field, .submit-btn, .back-link');
    
    // (1) 타이틀 등장
    if (title) {
        title.style.opacity = '0';
        title.style.transform = 'translateY(50px)';
        title.style.transition = 'all 1.4s cubic-bezier(0.22, 1, 0.36, 1)';
        
        setTimeout(() => {
            title.style.opacity = '1';
            title.style.transform = 'translateY(0)';
        }, 100);
    }
    
    // (2) 나머지 요소들 순차 등장
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(40px)';
        el.style.transition = 'all 1.2s cubic-bezier(0.22, 1, 0.36, 1)';
        
        // ★ 여기를 수정했습니다! (100 -> 250)
        // 요소들이 따닥! 올라오는 게 아니라, 0.25초 간격으로 천천히 하나씩 올라옵니다.
        setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 300 + (index * 250)); 
    });

    attachInputEvents();
}

// 입력창 효과 (그대로 유지)
function attachInputEvents() {
    document.querySelectorAll('.input-field').forEach(input => {
        input.style.transition = 'all 0.3s ease-out';
        
        input.addEventListener('focus', function() {
            this.style.transform = 'scale(1.02)';
            this.style.boxShadow = '0 4px 20px rgba(212, 165, 116, 0.3)';
            this.style.background = 'rgba(255, 255, 255, 0.65)';
        });
        
        input.addEventListener('blur', function() {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = 'none';
            this.style.background = 'rgba(255, 255, 255, 0.5)';
        });
    });
}

// 검은 화면 방지용 load 이벤트 (그대로 유지)
window.addEventListener('load', () => {
    playEnterAnimation();
});
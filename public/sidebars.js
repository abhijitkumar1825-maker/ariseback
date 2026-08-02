document.addEventListener("DOMContentLoaded", () => {
    const sidebarHTML = `
        <aside class="fixed top-0 left-0 h-full w-64 bg-arise-card border-r border-purple-900/30 flex flex-col justify-between z-50 p-6 shadow-2xl backdrop-blur-md">
            <div>
                <div class="flex items-center space-x-3 mb-10">
                    <img src="./logo.png" alt="Logo" class="h-10 w-10 object-contain" onerror="this.style.display='none'">
                    <span class="font-heading text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300">ARISE SMP</span>
                </div>
                <nav class="space-y-3 font-heading text-lg">
                    <a href="/" class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-900/30 text-gray-300 hover:text-white transition">🏠 Home</a>
                    <a href="/ranks" class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-900/30 text-gray-300 hover:text-white transition">💎 Server Store</a>
                    <a href="/rules" class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-900/30 text-gray-300 hover:text-white transition">📜 Server Rules</a>
                    <a href="/appeal" class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-900/30 text-gray-300 hover:text-white transition">🛡️ Ban Appeals</a>
                </nav>
            </div>
            <div>
                <a href="https://discord.gg/arisesmp" target="_blank" class="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-heading font-bold shadow-lg shadow-purple-600/50 animate-pulse hover:shadow-[0_0_25px_rgba(168,85,247,0.8)] transition">
                    💬 Discord Community
                </a>
            </div>
        </aside>
    `;
    
    const wrapper = document.createElement('div');
    wrapper.innerHTML = sidebarHTML;
    document.body.prepend(wrapper.firstElementChild);
});
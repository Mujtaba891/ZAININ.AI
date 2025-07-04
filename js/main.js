function initSidebarToggle(){const s=document.querySelector(".sidebar"),t=document.getElementById("sidebar-toggle"),m=document.querySelector(".main-content");if(!s||!t||!m)return;t.addEventListener("click",()=>{s.classList.toggle("active");m.classList.toggle("sidebar-active");});}
// WARNING: THIS IS A DUMMY API CALL. REAL API CALLS REQUIRE A SECURE BACKEND.
function getBotResponse(msg,keys){
    console.log("Dummy API call with message:", msg, "and keys (UNSAFE exposure):", keys);
    if (!keys || (!keys.deepseek && !keys.openrouter)) return "AI keys missing. Add them in Profile.";
    if (msg.toLowerCase().includes('search')) {
        if (!keys.serp) return "Serp key missing for search.";
        return `Dummy Search Result for: "${msg}"`;
    }
    return `Dummy AI Response to: "${msg}"`; // Simulate AI response
}
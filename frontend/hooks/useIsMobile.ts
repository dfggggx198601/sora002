import { useState, useEffect } from 'react';

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkIsMobile = () => {
            // Check window width or user agent
            const isNarrow = window.innerWidth < 768;
            // Optional: Check user agent for more specificity if needed, but width is usually sufficient for responsive layout
            // const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            setIsMobile(isNarrow);
        };

        // Initial check
        checkIsMobile();

        // Listener
        window.addEventListener('resize', checkIsMobile);

        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    return isMobile;
}

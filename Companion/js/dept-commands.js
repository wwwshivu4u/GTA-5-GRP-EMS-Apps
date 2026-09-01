/**
 * EMS Companion - Department Commands Search & Filter Engine
 */

export class DeptCommandsService {
    static toggleSection(element) {
        element.parentElement.classList.toggle('collapsed');
    }

    static toggleAccordion(element) {
        element.parentElement.classList.toggle('active');
    }

    static jumpToSection(secId) {
        const sec = document.getElementById(secId);
        if (sec) {
            sec.classList.remove('collapsed');
            setTimeout(() => {
                sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
        }
    }

    static toggleAllSections() {
        const sections = document.querySelectorAll('#tab-rc-dept .glass-section.collapsible');
        let anyCollapsed = false;
        sections.forEach(sec => {
            if (sec.classList.contains('collapsed')) anyCollapsed = true;
        });

        sections.forEach(sec => {
            if (anyCollapsed) {
                sec.classList.remove('collapsed');
            } else {
                sec.classList.add('collapsed');
            }
        });
    }

    static filterCommands() {
        const searchInput = document.getElementById('filter-search');
        const loc2Select = document.getElementById('filter-loc2');
        if (!searchInput || !loc2Select) return;

        const searchVal = searchInput.value.toLowerCase().trim();
        const loc2 = loc2Select.value;
        const sections = document.querySelectorAll('#tab-rc-dept .glass-section.collapsible');

        sections.forEach(sec => {
            let hasVisibleBlock = false;
            const blocks = sec.querySelectorAll('.copy-block');

            blocks.forEach(b => {
                const bLoc2 = b.getAttribute('data-loc2') || 'ALL';
                const text = b.querySelector('.copy-content')?.textContent.toLowerCase() || '';

                const matchesSearch = searchVal === '' || text.includes(searchVal);
                const matchesLoc = loc2 === 'ALL' || loc2 === bLoc2 || bLoc2.includes(loc2);

                if (matchesSearch && matchesLoc) {
                    b.classList.remove('filtered-out');
                    b.style.display = '';
                    hasVisibleBlock = true;
                } else {
                    b.classList.add('filtered-out');
                    b.style.display = 'none';
                }
            });

            const chip = document.querySelector(`button[onclick*="'${sec.id}'"]`);

            if (hasVisibleBlock) {
                sec.style.display = '';
                if (chip) {
                    chip.disabled = false;
                    chip.style.opacity = '1';
                    chip.style.cursor = 'pointer';
                }
                if (loc2 !== 'ALL' || searchVal !== '') {
                    sec.classList.remove('collapsed');
                }
            } else {
                sec.style.display = 'none';
                if (chip) {
                    chip.disabled = true;
                    chip.style.opacity = '0.3';
                    chip.style.cursor = 'not-allowed';
                }
            }
        });
    }
}


export default function backstick() {
    /** 
     * <path d="M30,20 A10,10 0 1,1 30,19.9" 
          fill="black"/>
        <line x1="0" y1="35" x2="40" y2="0" 
          stroke="black" 
          stroke-width="2"/>
     */
    const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  
    newPath.setAttribute('d', 'M30,20 A10,10 0 1,1 30,19.9');
    newPath.setAttribute('fill', 'black');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0')
    line.setAttribute('y1', '35')
    line.setAttribute('x2', '40')
    line.setAttribute('y2', '0')
    line.setAttribute('stroke', 'black')
    line.setAttribute('stroke-width', 2)
    return [newPath, line]    
}
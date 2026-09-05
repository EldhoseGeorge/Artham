const style = document.createElement("style");
style.textContent = `
#tooltipdiv {
    display:flex;
    flex-direction: column;
    overflow:auto;
    scrollbar-width: thin;  
    scrollbar-color: rgba(0, 0, 0, 0.2) transparent; 
    max-height:300px;
    max-width:400px;
    position:absolute;
    z-index:999999;
    animation: fadein .3s ease-in-out;
    border-radius: 3%;
    background: linear-gradient(135deg, #ffffff, #f0f8ff);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);

}
    #tooltipdiv::-webkit-scrollbar {
  width: 6px;
}

#tooltipdiv::-webkit-scrollbar-track {
  background: transparent;
}

#tooltipdiv::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 4px;
  transition: background 0.3s ease;
}

#tooltipdiv::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.4);
}

.closebutton {
  background-color: transparent;
  border: none;
  color: black;
  text-align: right;
  cursor: pointer; /* optional: shows pointer on hover */
  padding: 10px; /* optional: remove default button padding */
}
.wordblock{
   margin-bottom: 10px;
  padding: 5px;}

.label{
    display: block;
  color: #666;
  font-style: italic;
  margin-bottom: 5px;}

  .meaningblock{
  margin-left: 10px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}
  .meaningtext{
    display: block;
    padding: 4px 8px;
    margin: 0 4px 6px 0;
    border: 1px solid rgba(40, 40, 43, 0.06);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.52);
    box-shadow: 0 2px 8px rgba(40, 40, 43, 0.06);
    color: inherit;
  }
  .collapsible {
    display: block;
    width: 100%;
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    text-align: left;
    line-height: 1.5;
    max-height: 3em;
    overflow: hidden;
    position: relative;
    padding-right: 1.5em;
    transition: max-height 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .collapsible::after {
    content: "+";
    position: absolute;
    right: 0;
    top: 0;
    font-weight: bold;
    text-decoration: none;
    transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .collapsible.active {
    max-height: 1000px;
  }
  .collapsible.active::after {
    content: "-";
    transform: rotate(180deg);
  }
 .tooltip{
display: flex;
  flex-direction: column;
  padding: 10px;
  z-index: 1000;
  color: black;
  font-family: 'Helvetica Neue', 'Segoe UI', Helvetica, sans-serif;
 }
.wordtitle{
  display: flex;
  flex-direction: row;
}
.word{
text-align: center;
  flex-grow: 2;
  
}
  @keyframes fadein {
    from {opacity: 0;}
    to {opacity: 1;}
}
 
`;

export { style };

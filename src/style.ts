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

.fav {
  background-color: transparent;
  border: none;
  color: black;
  text-align: center;
  cursor: pointer; /* optional: shows pointer on hover */
  padding: 0; /* optional: remove default button padding */
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
    padding: 2px 5px;
    margin-bottom: 3px;
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

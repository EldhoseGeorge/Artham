const style = document.createElement("style");
style.textContent = `
#tooltipdiv {
    display:flex;
    flex-direction: column;
    overflow:auto;
    max-height:300px;
    max-width:400px;
    position:absolute;
    z-index:999999;
    animation: fadein .3s ease-in-out;
}

.fav {
  background-color: transparent;
  border: none;
  color: black;
  text-align: center;
  cursor: pointer; /* optional: shows pointer on hover */
  font-size: 1.2em; /* optional: make emoji/text bigger */
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
  border: 1px solid #ccc;
  padding: 10px;
  z-index: 1000;
  background-color: #F2F2F2;
  color: black;
  border-radius: 5px;
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

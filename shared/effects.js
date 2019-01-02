(function(){

  function Effect(eType, player){
    //Variables if applicable: rate: amount per time interval, length: time effective
    this.eType = eType;
    this.player = player;

    this.startTime = Date.now();
    this.terminate = false;//to let owner delete when necessary

    this.update;//called by character updatestats

    switch(eType){
    case(Game.enums.EType.invincible):
    //?? what if different lengths of invincible? assign after call? pass in additional arguments?
    this.length = 4000;//magic number. 
    this.update = this.invincibleUpdate;
    this.player.tokens.set(Game.enums.Token.invincible, true);
    break;
    
    }
  }
  Effect.prototype.draw = function(context){
    
    switch(this.eType){
      case(Game.enums.EType.invincible):
      if(debug) console.log(`effect draw: eType: ${this.eType}`);
      context.beginPath();
      context.strokeStyle = 'rgb(255, 215, 0)';
      context.lineWidth = 3;
      context.arc(0, 0, this.player.radius, 0, 2 * PI);
      context.stroke();
      break;
      
    }
  }

  Effect.prototype.invincibleUpdate = function(){
      if(Date.now() - this.startTime > this.length){
        //delete associated token
        this.player.tokens.delete(Game.enums.Token.invincible);
        //delete effect from player effects list
        this.terminate = true;
      } 
  }


  Game.Effect = Effect;
})();
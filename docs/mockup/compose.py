import sys
from PIL import Image, ImageDraw, ImageFilter
W,H=746,586
bg=Image.open('bg_sill.png').convert('RGBA')
s=max(W/bg.width,H/bg.height); bw,bh=round(bg.width*s),round(bg.height*s)
bg=bg.resize((bw,bh),Image.LANCZOS).crop(((bw-W)//2,0,(bw-W)//2+W,H))
SP=0.216; PX=373; PBOT=502          # pot scale, center x, pot bottom y in scene
SOILY=270; POTCX=628; POTBOT=1138    # measured in pot image
SL=0.22; STEMX=545; STEMY=1415       # plant scale, stem base in plant image
def pot_layers(f):
    p=Image.open(f).convert('RGBA'); p=p.resize((round(p.width*SP),round(p.height*SP)),Image.LANCZOS)
    cut=round(SOILY*SP); front=p.copy(); front.paste((0,0,0,0),(0,0,p.width,cut)); return p,front
def scene(potf, plant=True, wilt=False):
    im=bg.copy()
    sh=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(sh)
    d.ellipse((PX-118,PBOT-16,PX+118,PBOT+12),fill=(90,50,10,90)); im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)))
    back,front=pot_layers(potf)
    px=round(PX-POTCX*SP); py=round(PBOT-POTBOT*SP)
    im.alpha_composite(back,(px,py))
    if plant:
        pl=Image.open('plant_balsam_bud.png').convert('RGBA'); pl=pl.resize((round(pl.width*SL),round(pl.height*SL)),Image.LANCZOS)
        if wilt:
            from PIL import ImageEnhance
            pl=ImageEnhance.Color(pl).enhance(0.35); r,g,b,a=pl.split()
            pl=Image.merge('RGBA',(r.point(lambda v:min(255,int(v*1.12))),g,b.point(lambda v:int(v*0.7)),a))
            bx,by=STEMX*SL,STEMY*SL
            pl=pl.rotate(-16,center=(bx,by),resample=Image.BICUBIC)
        soil_y=py+SOILY*SP
        im.alpha_composite(pl,(round(PX-STEMX*SL),round(soil_y+9-STEMY*SL)))
    im.alpha_composite(front,(px,py))
    return im
scene('pot_happy.png').save('scene_grow.png')
scene('pot_happy.png',plant=False).save('scene_seed.png')
scene('pot_worried.png',wilt=True).save('scene_dead.png')
print('ok')

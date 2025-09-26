from flask_sqlalchemy import SQLAlchemy
from app import dhaka_time

db = SQLAlchemy() 

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(180))
    content = db.Column(db.Text)
    pinned = db.Column(db.Boolean, default=False)
    type = db.Column(db.String(10))  # "Query" or "Patch"
    category = db.Column(db.String(20)) 
    ip_address = db.Column(db.String(45))  # to store IPv4 or IPv6
    last_modified_ip = db.Column(db.String(45)) 
    submitted_by = db.Column(db.String(50))
    last_modified_by = db.Column(db.String(50))
    likes = db.Column(db.Integer, default=0)
    comments = db.relationship('Comment', backref='post', cascade='all, delete-orphan')
    likes_relation = db.relationship('PostLike', backref='post', cascade='all, delete-orphan')
    history_relation = db.relationship('PostHistory', backref='original_post', cascade='all, delete-orphan', passive_deletes=True)
    reference_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=True)
    reference = db.relationship('Post', remote_side=[id], backref='patches')
    notifications = db.relationship('Notification', backref='post', passive_deletes=True)
    featured = db.relationship('FeaturedPost', backref='feat_post', cascade='all, delete-orphan', passive_deletes=True)
    followers = db.relationship('PostFollow', backref='followed_post', cascade='all, delete-orphan', passive_deletes=True)
    is_visible = db.Column(db.Boolean, default=True)
    edit_access = db.Column(db.String(10), default="read")
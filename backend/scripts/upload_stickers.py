import os
import sys
import subprocess

# Ensure boto3 is installed
try:
    import boto3
    from botocore.client import Config
except ImportError:
    print("boto3 not found. Installing boto3 dynamically...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "boto3"])
    import boto3
    from botocore.client import Config

def load_env(env_path):
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = line.split('=', 1)
                if len(parts) == 2:
                    env_vars[parts[0].strip()] = parts[1].strip()
    return env_vars

def main():
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    env_path = os.path.join(backend_dir, ".env")
    env = load_env(env_path)
    
    endpoint = env.get("B2_ENDPOINT")
    key_id = env.get("B2_KEY_ID")
    app_key = env.get("B2_APP_KEY")
    bucket_name = env.get("B2_BUCKET_NAME")
    
    if not all([endpoint, key_id, app_key, bucket_name]):
        print(f"Error: Missing B2 credentials in env: {env_path}")
        sys.exit(1)
        
    print(f"B2 Endpoint: {endpoint}")
    print(f"B2 Bucket: {bucket_name}")
    print(f"B2 Key ID: {key_id}")
    
    # Initialize S3 Client compatible with B2
    s3 = boto3.client(
        service_name='s3',
        endpoint_url=endpoint,
        aws_access_key_id=key_id,
        aws_secret_access_key=app_key,
        config=Config(signature_version='s3v4')
    )
    
    # Mapping of B2 target keys to local paths
    stickers_to_upload = {
        "stickers/packs/meow/cover.png": r"C:\Users\ACER\.gemini\antigravity\brain\71bab537-7a8c-4175-a99a-8a5481e09ceb\meow_cover_1781385383947.png",
        "stickers/packs/meow/smile.png": r"C:\Users\ACER\.gemini\antigravity\brain\71bab537-7a8c-4175-a99a-8a5481e09ceb\meow_smile_1781385394328.png",
        "stickers/packs/meow/cry.png":   r"C:\Users\ACER\.gemini\antigravity\brain\71bab537-7a8c-4175-a99a-8a5481e09ceb\meow_cry_1781385405615.png",
        "stickers/packs/pepe/cover.png": r"C:\Users\ACER\.gemini\antigravity\brain\71bab537-7a8c-4175-a99a-8a5481e09ceb\pepe_cover_1781385417305.png",
        "stickers/packs/pepe/sad.png":   r"C:\Users\ACER\.gemini\antigravity\brain\71bab537-7a8c-4175-a99a-8a5481e09ceb\pepe_sad_1781385427693.png",
    }
    
    for b2_key, local_path in stickers_to_upload.items():
        if not os.path.exists(local_path):
            print(f"Error: Local file not found: {local_path}")
            continue
        
        print(f"Uploading {local_path} to {bucket_name}/{b2_key} ...")
        try:
            s3.upload_file(
                Filename=local_path,
                Bucket=bucket_name,
                Key=b2_key,
                ExtraArgs={'ContentType': 'image/png'}
            )
            print(f"Successfully uploaded {b2_key}")
        except Exception as e:
            print(f"Failed to upload {b2_key}: {e}")

if __name__ == '__main__':
    main()

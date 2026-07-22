# Hypershield Private Club

Bolt에서 개발, GitHub Pages에서 호스팅하는 프로젝트입니다.

## 로컬 개발

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

빌드 결과는 `dist/` 폴더에 생성됩니다.

## GitHub Pages 배포

이 프로젝트는 `main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드하고 GitHub Pages에 배포합니다.

### 최초 설정 방법

1. 이 저장소를 GitHub에 올립니다 (`freeskill23/hypershield` 권장).
2. GitHub 저장소 → **Settings** → **Pages** 로 이동
3. **Source** 를 **GitHub Actions** 로 선택
4. `main` 브랜치에 push하면 자동으로 배포됩니다

### 커스텀 도메인 연결 (선택)

1. GitHub 저장소 → **Settings** → **Pages**
2. **Custom domain** 필드에 도메인 입력 (예: `hypershield.com`)
3. DNS 설정에서 A 레코드 또는 CNAME 추가:
   - **A 레코드** (Apex 도메인):
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - **CNAME** (www 서브도메인): `your-username.github.io`
4. **Enforce HTTPS** 체크 권장

### 환경 변수

Supabase 연결 정보는 빌드 시점에 코드에 포함됩니다.
추가 환경 변수가 필요한 경우 GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions** 에 등록하고 워크플로우에서 참조하세요.

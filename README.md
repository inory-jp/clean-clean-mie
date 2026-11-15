# clean×clean サイト

Astroで構築したclean×cleanのWebサイト。作業・公開はAGENTS.mdに従う。

## 管理対象

- GitHub: inory-jp/clean-clean-mie（public）
- Vercel: clean-clean-mie / prj_zjkbKNGEDPLEJaUxAEaFlILl8Ulo
- Production Branch: main / Root Directory: repositoryルート
- 本番: https://cleanclean-mie.jp/ / https://www.cleanclean-mie.jp/

## ローカル起動

package.jsonのNode要件とpackage-lock.jsonを使用する。

```sh
npm ci
npm run dev
```

コードはsrc/、公開静的ファイルはpublic/。外部サービスの接続値は承認された環境から渡し、README・ログ・PRへ値を書かない。

## 検証

```sh
npm run build
npm run preview
```

buildはビルド確認、previewはローカル確認用サーバー。Git連携Previewでの確認も行う。
現時点では専用のlint・型チェックscriptは未定義。変更内容に応じて必要なチェックを選び、実施結果と未確認事項を記録する。
microCMSやメール配信など、外部サービスの環境差異にも注意する。

## 公開手順

1. 最新origin/mainから専用worktree・作業ブランチを用意する。既存の未コミット作業を混ぜない。
2. 対象だけを変更・検証し、個別にstageしてcommitする。
3. 作業ブランチへpushし、base=mainのPRを作成する。
4. VercelのGit連携Previewで、最新head SHAとの一致とビルド成功を確認する。
5. PC・スマホ幅で対象ページ、画像、内部リンク、問い合わせ画面を確認する。実送信は送信先と承認範囲を別途確定する。
6. 本人へ差分・SHA・Preview URL・検証結果を提示する。追加commit後は再確認する。
7. 本人がGitHub画面でMergeする。main保護のチェックを迂回しない。
8. Merge後、ProductionのソースSHAとmainを照合し、本番URLの表示を確認する。

mainへの直接push・CodexによるMerge・CLI/APIからの直接本番デプロイは行わない。

## 復旧

不具合時は対象commit・deployment ID・影響を記録し、本人へ報告する。承認された正常deploymentへの復旧または修正PRで対応する。
デプロイの巻戻しはmicroCMSの変更や送信済みメールを戻さない。force pushや既存作業のresetで復旧しない。
